// Step 1: Fetch and filter ERC-20 tokens by holder count (without analyzing overlap)
import { MoralisConfig } from '../../moralis-config.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = (searchParams.get('address') || '').trim().toLowerCase();
    
    if (!address) {
      return new Response(
        JSON.stringify({ error: 'Missing address parameter' }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }

    const apiKey = process.env.MORALIS_API_KEY || process.env.NEXT_PUBLIC_MORALIS_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Moralis API key not configured' }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }

    const baseUrl = 'https://deep-index.moralis.io/api/v2.2';
    const chains = ['0x2105', '8453', 'base'];
    const minHolders = 2;
    const maxHolders = 10000;

    // Step 1: Get wallet's ERC-20 tokens
    let tokensData = null;
    let chain = null;

    for (const chainFormat of chains) {
      const tokensUrl = `${baseUrl}/${address}/erc20?chain=${chainFormat}`;
      
      const tokensResponse = await fetch(tokensUrl, {
        headers: { 'Accept': 'application/json', 'X-API-Key': apiKey }
      });

      if (tokensResponse.ok) {
        const data = await tokensResponse.json();
        
        if (data && (data.result?.length > 0 || (Array.isArray(data) && data.length > 0))) {
          tokensData = data;
          chain = chainFormat;
          break;
        }
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

    // Step 2: Filter tokens by holder count (with batch processing)
    const filteredTokens = [];
    const BATCH_SIZE = 5; // Process 5 tokens simultaneously
    
    // Helper function to check a single token
    const checkToken = async (token) => {
      try {
        const holdersUrl = `${baseUrl}/erc20/${token.token_address}/holders?chain=${chain}`;
        const holdersResponse = await fetch(holdersUrl, {
          headers: { 'Accept': 'application/json', 'X-API-Key': apiKey }
        });

        if (holdersResponse.ok) {
          const holdersData = await holdersResponse.json();
          const holderCount = holdersData.totalHolders || 0;

          if (holderCount >= minHolders && holderCount <= maxHolders) {
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
        // Silently skip failed tokens
      }
      return null;
    };

    // Process tokens in batches
    for (let i = 0; i < allTokens.length; i += BATCH_SIZE) {
      const batch = allTokens.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(checkToken));
      
      // Add non-null results
      results.forEach(result => {
        if (result) filteredTokens.push(result);
      });
      
      // Small delay between batches
      if (i + BATCH_SIZE < allTokens.length) {
        await new Promise(resolve => setTimeout(resolve, MoralisConfig.delayMs));
      }
    }

    // Calculate estimates if user selects all tokens
    const avgHolders = filteredTokens.length > 0 
      ? filteredTokens.reduce((sum, t) => sum + t.holderCount, 0) / filteredTokens.length 
      : 0;
    const timeEstimate = MoralisConfig.estimateTime(filteredTokens.length, avgHolders);
    const costEstimate = MoralisConfig.estimateCost(filteredTokens.length, avgHolders);

    return new Response(
      JSON.stringify({
        sourceWallet: address,
        chain,
        totalTokens: allTokens.length,
        filteredTokens: filteredTokens.sort((a, b) => b.holderCount - a.holderCount), // Sort by holder count
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
    console.error('[Filtered Tokens] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}

