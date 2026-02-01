// Step 1: Fetch and filter ERC-20 tokens by holder count (without analyzing overlap)
import { MoralisConfig } from '../../moralis-config.js';
import { validateAddressParam } from '../../lib/validation.js';
import { processWithConcurrency } from '../../lib/concurrency.js';
import { fetchWithRetry } from '../../lib/fetch-with-retry.js';
import { getCached, TTL } from '../../lib/cache.js';

// Tell Next.js this route is always dynamic (uses request.url)
export const dynamic = 'force-dynamic';

export async function GET(request) {
  console.log('\n\n========================================');
  console.log('🚀 NEW REQUEST: get-filtered-tokens API');
  console.log('========================================\n');

  try {
    const { searchParams } = new URL(request.url);
    const address = (searchParams.get('address') || '').trim().toLowerCase();

    // Validate address format
    const validationError = validateAddressParam(address);
    if (validationError) return validationError;

    const apiKey = process.env.MORALIS_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing MORALIS_API_KEY in environment' }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }

    const baseUrl = 'https://deep-index.moralis.io/api/v2.2';
    const chains = ['base', '0x2105']; // Try Base network formats (name first, then hex)
    const minHolders = 2;
    const maxHolders = 10000;

    console.log(`\n🔍 Fetching ERC-20 tokens for wallet: ${address}`);
    console.log(`   Filter: ${minHolders}-${maxHolders} holders on Base Mainnet\n`);

    // Step 1: Get wallet's ERC-20 tokens
    let tokensData = null;
    let chain = null;

    for (const chainFormat of chains) {
      const tokensUrl = `${baseUrl}/${address}/erc20?chain=${chainFormat}`;
      
      console.log(`   Trying chain: ${chainFormat}`);
      console.log(`   URL: ${tokensUrl.replace(apiKey, 'API_KEY')}`);
      
      const tokensResponse = await fetchWithRetry(tokensUrl, {
        headers: { 'Accept': 'application/json', 'X-API-Key': apiKey }
      }, { maxRetries: 2, baseDelayMs: 500 });

      if (tokensResponse.ok) {
        const data = await tokensResponse.json();
        
        if (data && (data.result?.length > 0 || (Array.isArray(data) && data.length > 0))) {
          tokensData = data;
          chain = chainFormat;
          const tokenCount = Array.isArray(data) ? data.length : (data.result?.length || 0);
          console.log(`   ✅ Found ${tokenCount} tokens on ${chainFormat} for ${address}\n`);
          break;
        } else {
          console.log(`   ❌ No tokens found on ${chainFormat}`);
        }
      } else {
        console.log(`   ⚠️ Request failed: ${tokensResponse.status}`);
      }
    }

    if (!tokensData || !chain) {
      return new Response(
        JSON.stringify({ 
          error: 'No tokens found for this wallet on Base',
          totalTokens: 0,
          filteredTokens: []
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    // Handle both response formats: direct array or {result: [...]}
    const allTokens = Array.isArray(tokensData) ? tokensData : (tokensData.result || []);

    // Pre-filter obvious spam tokens BEFORE making holder count API calls
    // This dramatically reduces the number of API calls needed
    const spamPatterns = [
      /claim\s*on/i,           // "Claim on: ..."
      /airdrop/i,              // Airdrop scams
      /^https?:\/\//i,         // Starts with URL
      /\.(com|xyz|live|io|net|org|co|claim)\/?/i,  // Contains domain
      /visit\s+/i,             // "Visit ..."
      /free\s+/i,              // "Free ..."
    ];

    const isSpamToken = (token) => {
      const name = token.name || '';
      const symbol = token.symbol || '';
      return spamPatterns.some(pattern => pattern.test(name) || pattern.test(symbol));
    };

    const legitimateTokens = allTokens.filter(token => !isSpamToken(token));
    const spamCount = allTokens.length - legitimateTokens.length;

    // Log configuration on first use
    MoralisConfig.logConfig();

    console.log(`\n📋 Pre-filtered ${spamCount} spam tokens, checking ${legitimateTokens.length} remaining (filter: ${minHolders}-${maxHolders} holders):\n`);

    // Step 2: Filter tokens by holder count (parallel batching for speed)
    // Keep concurrency at 4 to avoid rate limiting
    const CONCURRENCY = 4;
    const BATCH_DELAY_MS = 50;

    const tokenResults = await processWithConcurrency(
      legitimateTokens,
      CONCURRENCY,
      async (token) => {
        try {
          // Use caching for holder counts (30 min TTL)
          const holderCount = await getCached(
            `holders:${token.token_address}:${chain}`,
            async () => {
              const holdersUrl = `${baseUrl}/erc20/${token.token_address}/holders?chain=${chain}`;
              const holdersResponse = await fetchWithRetry(holdersUrl, {
                headers: { 'Accept': 'application/json', 'X-API-Key': apiKey }
              }, { maxRetries: 2, baseDelayMs: 500 });

              if (!holdersResponse.ok) return 0;
              const holdersData = await holdersResponse.json();
              return holdersData.totalHolders || 0;
            },
            TTL.TOKEN_HOLDERS
          );

          const passed = holderCount >= minHolders && holderCount <= maxHolders;
          const reason = holderCount < minHolders ? 'too few' : holderCount > maxHolders ? 'too many' : 'passed';

          console.log(`  ${passed ? '✅' : '❌'} ${token.symbol}: ${holderCount.toLocaleString()} holders (${reason})`);

          // Add small delay after each request to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));

          if (passed) {
            return {
              address: token.token_address,
              symbol: token.symbol || 'UNKNOWN',
              name: token.name || 'Unknown Token',
              holderCount,
              balance: token.balance_formatted || '0',
              logo: token.logo || token.thumbnail || null,
              usdValue: token.usd_value || null
            };
          }
        } catch (err) {
          console.log(`  ⚠️ ${token.symbol}: failed to fetch holder count`);
        }
        return null; // Token didn't pass filter or failed
      }
    );

    // Filter out null results (tokens that didn't pass or failed)
    const filteredTokens = tokenResults.filter(Boolean);

    // Calculate estimates if user selects all tokens
    const avgHolders = filteredTokens.length > 0 
      ? filteredTokens.reduce((sum, t) => sum + t.holderCount, 0) / filteredTokens.length 
      : 0;
    const timeEstimate = MoralisConfig.estimateTime(filteredTokens.length, avgHolders);
    const costEstimate = MoralisConfig.estimateCost(filteredTokens.length, avgHolders);

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ ERC-20 Filtering Results: ${allTokens.length} total → ${filteredTokens.length} passed`);
    console.log(`   🚫 ${spamCount} spam tokens pre-filtered`);
    console.log(`   📊 ${legitimateTokens.length} checked → ${filteredTokens.length} passed (${minHolders}-${maxHolders} holders)`);
    
    if (filteredTokens.length > 0) {
      console.log(`\n   ✅ Tokens that PASSED filter:`);
      filteredTokens.slice(0, 10).forEach(token => {
        console.log(`      • ${token.symbol}: ${token.holderCount.toLocaleString()} holders`);
      });
      if (filteredTokens.length > 10) {
        console.log(`      ... and ${filteredTokens.length - 10} more`);
      }
    } else {
      console.log(`\n   ⚠️  NO TOKENS passed the ${minHolders}-${maxHolders} holder filter`);
      console.log(`   💡 This wallet may only hold very popular tokens (>10k holders) or spam tokens`);
    }
    
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    return new Response(
      JSON.stringify({
        sourceWallet: address,
        chain,
        totalTokens: allTokens.length,
        filteredTokens: filteredTokens.sort((a, b) => b.holderCount - a.holderCount), // Sort by holder count (descending)
        criteria: { minHolders, maxHolders },
        estimates: {
          plan: MoralisConfig.plan,
          ifAllSelected: {
            time: timeEstimate.formatted,
            cost: costEstimate.formatted,
            note: 'Estimates assume all filtered tokens are selected for analysis'
          }
        }
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );

  } catch (error) {
    // Always log errors - Vercel captures these logs
    console.error('[Filtered Tokens] error', { message: error.message, stack: error.stack?.slice(0, 500) });
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}

