// Analyze ERC-20 token overlap to find kindred spirits
// Accepts a list of token addresses to analyze
import { MoralisConfig } from '../../moralis-config.js';
import { processWithConcurrency } from '../../lib/concurrency.js';
import { validateAddressParam } from '../../lib/validation.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const address = (body.address || '').trim().toLowerCase();
    const tokenAddresses = body.tokens || []; // Array of token addresses to analyze

    // Validate address format
    const validationError = validateAddressParam(address);
    if (validationError) return validationError;

    if (!tokenAddresses || tokenAddresses.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No tokens provided for analysis' }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }

    const apiKey = process.env.MORALIS_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Moralis API key not configured' }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }

    const baseUrl = 'https://deep-index.moralis.io/api/v2.2';
    const chain = '0x2105'; // Base network
    const maxHoldersPerToken = 150000;

    // Build token metadata from provided addresses
    const selectedTokens = tokenAddresses.map(t => ({
      address: t.address,
      symbol: t.symbol,
      name: t.name,
      holderCount: t.holderCount
    }));

    // Fetch owners for a single token (to be run in parallel)
    const fetchTokenOwners = async (token) => {
      try {
        let allOwners = [];
        let cursor = null;

        do {
          const params = new URLSearchParams({
            chain: chain,
            limit: String(MoralisConfig.pageSize)
          });
          if (cursor) params.set('cursor', cursor);

          const response = await fetch(
            `${baseUrl}/erc20/${token.address}/owners?${params}`,
            { headers: { 'Accept': 'application/json', 'X-API-Key': apiKey } }
          );

          if (!response.ok) break;

          const data = await response.json();
          const owners = data.result || [];
          allOwners = allOwners.concat(owners);
          cursor = data.cursor || null;

          if (allOwners.length >= maxHoldersPerToken) break;
        } while (cursor);

        return { token, owners: allOwners };
      } catch (err) {
        return { token, owners: [] };
      }
    };

    // Process all tokens in parallel with concurrency limit
    const CONCURRENCY = 4;
    const results = await processWithConcurrency(selectedTokens, CONCURRENCY, fetchTokenOwners);

    // Aggregate results into overlap map
    const overlapMap = new Map(); // wallet -> { count, tokens: [] }

    for (const { token, owners } of results) {
      for (const owner of owners) {
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
    console.error('[analyze-erc20-overlap] error', { message: error.message, stack: error.stack?.slice(0, 500) });
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}

