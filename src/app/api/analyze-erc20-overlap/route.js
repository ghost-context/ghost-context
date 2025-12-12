// Analyze ERC-20 token overlap to find kindred spirits
// Accepts a list of token addresses to analyze
import { MoralisConfig } from '../../moralis-config.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const address = (body.address || '').trim().toLowerCase();
    const tokenAddresses = body.tokens || []; // Array of token addresses to analyze
    
    if (!address) {
      return new Response(
        JSON.stringify({ error: 'Missing address parameter' }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }

    if (!tokenAddresses || tokenAddresses.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No tokens provided for analysis' }),
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
    const chain = '0x2105'; // Base network (we know this works from test)

    // Log configuration
    MoralisConfig.logConfig();
    
    console.log('[ERC-20 Overlap] Analyzing wallet:', address);
    console.log('[ERC-20 Overlap] Analyzing', tokenAddresses.length, 'selected tokens');
    console.log('[ERC-20 Overlap] Token addresses:', tokenAddresses.map(t => `${t.symbol} (${t.address})`).join(', '));

    // Build token metadata from provided addresses
    const selectedTokens = tokenAddresses.map(t => ({
      address: t.address,
      symbol: t.symbol,
      name: t.name,
      holderCount: t.holderCount
    }));

    // For each token, PAGINATE through ALL holders (like NFT code does)
    const overlapMap = new Map(); // wallet -> { count, tokens: [] }
    const maxHoldersPerToken = 150000; // Same limit as NFT analysis for performance

    for (const token of selectedTokens) {
      try {
        let allOwners = [];
        let cursor = null;
        let totalFetched = 0;

        console.log('[ERC-20 Overlap] Fetching ALL holders for:', token.symbol);

        // Paginate through ALL holders
        do {
          const ownersUrl = cursor 
            ? `${baseUrl}/erc20/${token.address}/owners?chain=${chain}&limit=${MoralisConfig.pageSize}&cursor=${cursor}`
            : `${baseUrl}/erc20/${token.address}/owners?chain=${chain}&limit=${MoralisConfig.pageSize}`;
          
          console.log('[ERC-20 Overlap] Fetching owners URL:', ownersUrl);
            
          const ownersResponse = await fetch(ownersUrl, {
            headers: { 'Accept': 'application/json', 'X-API-Key': apiKey }
          });

          console.log('[ERC-20 Overlap]', token.symbol, 'response status:', ownersResponse.status);

          if (!ownersResponse.ok) {
            const errorText = await ownersResponse.text();
            console.warn('[ERC-20 Overlap] ❌ Failed to get owners for:', token.symbol, 'Status:', ownersResponse.status, 'Error:', errorText);
            break;
          }

          const ownersData = await ownersResponse.json();
          console.log('[ERC-20 Overlap]', token.symbol, 'response preview:', JSON.stringify(ownersData).substring(0, 200));
          
          const owners = ownersData.result || [];
          
          allOwners.push(...owners);
          totalFetched += owners.length;
          cursor = ownersData.cursor; // Next page cursor

          console.log('[ERC-20 Overlap]', token.symbol, '- fetched', totalFetched, 'holders so far...');

          // Safety limit like NFT code
          if (totalFetched >= maxHoldersPerToken) {
            console.log('[ERC-20 Overlap]', token.symbol, '- reached max holder limit');
            break;
          }

          // Small delay between pages to avoid rate limiting
          if (cursor) {
            await new Promise(resolve => setTimeout(resolve, MoralisConfig.delayMs));
          }

        } while (cursor);

        console.log('[ERC-20 Overlap]', token.symbol, '- TOTAL:', allOwners.length, 'holders');

        // Count overlaps from ALL holders
        for (const owner of allOwners) {
          const ownerAddress = owner.owner_address.toLowerCase();
          
          // Skip the source wallet
          if (ownerAddress === address) continue;

          if (!overlapMap.has(ownerAddress)) {
            overlapMap.set(ownerAddress, { count: 0, tokens: [] });
          }

          const overlap = overlapMap.get(ownerAddress);
          overlap.count += 1;
          overlap.tokens.push({
            symbol: token.symbol,
            name: token.name,
            balance: owner.balance_formatted
          });
        }
      } catch (err) {
        console.warn('[ERC-20 Overlap] Error getting owners for:', token.symbol, err.message);
      }

      // Small delay between tokens
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Step 4: Sort kindred spirits by overlap count
    const kindredSpirits = Array.from(overlapMap.entries())
      .map(([wallet, data]) => ({
        address: wallet,
        overlapCount: data.count,
        sharedTokens: data.tokens,
        overlapPercentage: ((data.count / selectedTokens.length) * 100).toFixed(1)
      }))
      .sort((a, b) => b.overlapCount - a.overlapCount)
      .slice(0, 50); // Top 50

    console.log('[ERC-20 Overlap] Found', kindredSpirits.length, 'kindred spirits');
    console.log('[ERC-20 Overlap] Top kindred has', kindredSpirits[0]?.overlapCount, 'overlaps');

    // Calculate average holders for reporting
    const avgHolders = selectedTokens.reduce((sum, t) => sum + (t.holderCount || 0), 0) / selectedTokens.length;
    const costEstimate = MoralisConfig.estimateCost(selectedTokens.length, avgHolders);

    return new Response(
      JSON.stringify({
        sourceWallet: address,
        analyzedTokens: selectedTokens.length,
        allHoldersFetched: true,
        maxHolderLimit: maxHoldersPerToken,
        kindredSpirits,
        tokens: selectedTokens,
        config: {
          plan: MoralisConfig.plan,
          pageSize: MoralisConfig.pageSize,
          estimatedCost: costEstimate.formatted
        }
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ERC-20 Overlap] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}

