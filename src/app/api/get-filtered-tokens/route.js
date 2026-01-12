// Step 1: Fetch and filter ERC-20 tokens by holder count (without analyzing overlap)
import { MoralisConfig } from '../../moralis-config.js';
import { validateAddressParam } from '../../lib/validation.js';
import { processWithConcurrency } from '../../lib/concurrency.js';

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
      
      const tokensResponse = await fetch(tokensUrl, {
        headers: { 'Accept': 'application/json', 'X-API-Key': apiKey }
      });

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

    // Log configuration on first use
    MoralisConfig.logConfig();

    console.log(`\n📋 Checking ${allTokens.length} ERC-20 tokens (filter: ${minHolders}-${maxHolders} holders):\n`);

    // Step 2: Filter tokens by holder count (parallel batching for speed)
    // Process 4 tokens concurrently to stay within Vercel's 15s timeout
    // 227 tokens × 150ms sequential = 34s (TIMEOUT)
    // 227 tokens ÷ 4 concurrent × 150ms = ~8.5s (OK)
    const CONCURRENCY = 4;
    const BATCH_DELAY_MS = 50; // Small delay between batches to respect rate limits

    const tokenResults = await processWithConcurrency(
      allTokens,
      CONCURRENCY,
      async (token) => {
        try {
          const holdersUrl = `${baseUrl}/erc20/${token.token_address}/holders?chain=${chain}`;
          const holdersResponse = await fetch(holdersUrl, {
            headers: { 'Accept': 'application/json', 'X-API-Key': apiKey }
          });

          if (holdersResponse.ok) {
            const holdersData = await holdersResponse.json();
            const holderCount = holdersData.totalHolders || 0;

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
    console.log(`✅ ERC-20 Filtering Results: ${allTokens.length} total → ${filteredTokens.length} passed filter (${minHolders}-${maxHolders} holders)`);
    console.log(`   📊 ${filteredTokens.length} passed / ${allTokens.length - filteredTokens.length} filtered out`);
    
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
    if (process.env.NODE_ENV !== 'production') {
      console.error('[Filtered Tokens] error', error);
    }
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}

