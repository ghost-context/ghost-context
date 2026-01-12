// 🎯 Unified Kindred Spirit Analysis
// Combines NFT collections, POAP events, and ERC-20 tokens
import { MoralisConfig } from '../../moralis-config.js';
import { processWithConcurrency } from '../../lib/concurrency.js';
import { validateAddressParam } from '../../lib/validation.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const address = (body.address || '').trim().toLowerCase();
    const selectedNFTs = body.nfts || [];
    const selectedPOAPs = body.poaps || [];
    const selectedERC20s = body.erc20s || [];

    // Validate address format
    const validationError = validateAddressParam(address);
    if (validationError) return validationError;

    const totalAssets = selectedNFTs.length + selectedPOAPs.length + selectedERC20s.length;
    if (totalAssets === 0) {
      return new Response(
        JSON.stringify({ error: 'No assets selected for analysis' }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }

    // Central overlap tracking (thread-safe via sequential aggregation after parallel fetch)
    const overlapMap = new Map(); // wallet -> { count, assets: { nfts: [], poaps: [], erc20s: [] } }

    // Helper to add overlap (called after parallel fetching completes)
    const addOverlap = (walletAddress, assetInfo, assetType) => {
      // Skip source wallet (compare lowercase addresses)
      if (walletAddress.toLowerCase() === address.toLowerCase()) return;

      if (!overlapMap.has(walletAddress)) {
        overlapMap.set(walletAddress, {
          count: 0,
          assets: { nfts: [], poaps: [], erc20s: [] }
        });
      }

      const overlap = overlapMap.get(walletAddress);

      // Check if this specific asset is already counted
      const assetKey = assetType === 'nft' ? assetInfo.address :
                       assetType === 'poap' ? assetInfo.eventId :
                       assetInfo.address;

      const alreadyCounted = overlap.assets[`${assetType}s`].some(a => {
        const existingKey = assetType === 'nft' ? a.address :
                           assetType === 'poap' ? a.eventId :
                           a.address;
        return existingKey === assetKey;
      });

      if (!alreadyCounted) {
        overlap.count += 1;
        overlap.assets[`${assetType}s`].push(assetInfo);
      }
    };

    // ========================================
    // 1. ANALYZE NFT COLLECTIONS (Alchemy) - PARALLEL
    // ========================================
    const fetchNFTOwners = async (nft) => {
      try {
        const { AlchemyMultichainClient } = await import('../../alchemy-multichain-client.js');
        const alchemy = new AlchemyMultichainClient();

        let owners = [];
        let pageKey = undefined;

        do {
          const resp = await alchemy.forNetwork(nft.network).nft.getOwnersForContract(nft.address, { pageKey });
          const batch = resp?.owners || [];
          owners = owners.concat(batch);

          if (owners.length > 150000) break;
          pageKey = resp?.pageKey;
        } while (pageKey);

        return { nft, owners };
      } catch (err) {
        return { nft, owners: [] };
      }
    };

    // ========================================
    // 2. ANALYZE POAP EVENTS - PARALLEL
    // ========================================
    const fetchPOAPHolders = async (poap) => {
      try {
        let page = 0;
        let pageCount = 0;
        let totalHolders = 0;
        let allHolders = [];

        do {
          const urlBase = 'http://localhost:3000';
          const url = new URL('/api/poap/event', urlBase);
          url.searchParams.set('id', poap.eventId);
          url.searchParams.set('page', String(page));

          const res = await fetch(url.toString(), { next: { revalidate: 300 } });
          if (!res.ok) break;

          const data = await res.json();
          const holders = Array.isArray(data?.holders) ? data.holders : [];
          pageCount = holders.length;
          totalHolders += holders.length;
          allHolders = allHolders.concat(holders);

          page += 1;
          if (totalHolders >= 150000) break;
        } while (pageCount === 500);

        return { poap, holders: allHolders };
      } catch (err) {
        return { poap, holders: [] };
      }
    };

    // ========================================
    // 3. ANALYZE ERC-20 TOKENS (Moralis) - PARALLEL
    // ========================================
    const apiKey = process.env.MORALIS_API_KEY || process.env.NEXT_PUBLIC_MORALIS_API_KEY;
    const fetchERC20Owners = async (token) => {
      if (!apiKey) return { token, owners: [] };

      const baseUrl = 'https://deep-index.moralis.io/api/v2.2';
      const chain = '0x2105'; // Base network

      try {
        let cursor = null;
        let allOwners = [];

        do {
          const params = new URLSearchParams({
            chain: chain,
            limit: String(MoralisConfig.pageSize)
          });
          if (cursor) params.set('cursor', cursor);

          const response = await fetch(
            `${baseUrl}/erc20/${token.address}/owners?${params}`,
            {
              headers: {
                'accept': 'application/json',
                'X-API-Key': apiKey
              }
            }
          );

          if (!response.ok) break;

          const data = await response.json();
          const owners = data.result || [];
          allOwners = allOwners.concat(owners);
          cursor = data.cursor || null;

          if (allOwners.length > 150000) break;
        } while (cursor);

        return { token, owners: allOwners };
      } catch (err) {
        return { token, owners: [] };
      }
    };

    // ========================================
    // EXECUTE ALL FETCHES IN PARALLEL
    // ========================================
    const CONCURRENCY = 4;

    // Run all three asset types concurrently
    const [nftResults, poapResults, erc20Results] = await Promise.all([
      selectedNFTs.length > 0
        ? processWithConcurrency(selectedNFTs, CONCURRENCY, fetchNFTOwners)
        : Promise.resolve([]),
      selectedPOAPs.length > 0
        ? processWithConcurrency(selectedPOAPs, CONCURRENCY, fetchPOAPHolders)
        : Promise.resolve([]),
      selectedERC20s.length > 0
        ? processWithConcurrency(selectedERC20s, CONCURRENCY, fetchERC20Owners)
        : Promise.resolve([])
    ]);

    // Aggregate NFT results
    for (const { nft, owners } of nftResults) {
      for (const owner of owners) {
        const ownerAddress = typeof owner === 'string' ? owner : (owner?.ownerAddress || owner);
        if (!ownerAddress) continue;
        addOverlap(ownerAddress.toLowerCase(), {
          address: nft.address,
          network: nft.network,
          name: nft.name,
          type: 'NFT'
        }, 'nft');
      }
    }

    // Aggregate POAP results
    for (const { poap, holders } of poapResults) {
      for (const holder of holders) {
        addOverlap(holder.toLowerCase(), {
          eventId: poap.eventId,
          name: poap.name,
          type: 'POAP'
        }, 'poap');
      }
    }

    // Aggregate ERC-20 results
    for (const { token, owners } of erc20Results) {
      for (const owner of owners) {
        addOverlap(owner.owner_address.toLowerCase(), {
          address: token.address,
          symbol: token.symbol,
          name: token.name,
          balance: owner.balance_formatted,
          type: 'ERC-20'
        }, 'erc20');
      }
    }

    // ========================================
    // 4. COMPILE RESULTS
    // ========================================
    
    console.log(`\n📊 Analysis Complete:`);
    console.log(`   Total wallets with ANY overlap: ${overlapMap.size}`);
    console.log(`   Source wallet: ${address}`);
    
    // Determine minimum overlap threshold
    const minOverlap = totalAssets >= 2 ? 2 : 1;
    console.log(`   Minimum overlap threshold: ${minOverlap} assets`);

    const kindredSpirits = Array.from(overlapMap.entries())
      .filter(([wallet, data]) => data.count >= minOverlap) // Must have at least minOverlap shared assets
      .map(([wallet, data]) => ({
        address: wallet,
        overlapCount: data.count,
        overlapPercentage: ((data.count / totalAssets) * 100).toFixed(1),
        sharedAssets: {
          nfts: data.assets.nfts,
          poaps: data.assets.poaps,
          erc20s: data.assets.erc20s
        },
        totalShared: data.count
      }))
      .sort((a, b) => b.overlapCount - a.overlapCount)
      .slice(0, 100); // Top 100 after filtering

    console.log(`   Kindred spirits found (>= ${minOverlap} overlaps): ${kindredSpirits.length}`);
    console.log(`   Filtered out (< ${minOverlap} overlaps): ${overlapMap.size - kindredSpirits.length}\n`);

    return new Response(
      JSON.stringify({
        success: true,
        walletAddress: address,
        analyzedAssets: {
          nfts: selectedNFTs.length,
          poaps: selectedPOAPs.length,
          erc20s: selectedERC20s.length,
          total: totalAssets
        },
        kindredSpirits,
        totalKindredSpirits: kindredSpirits.length,
        minOverlapThreshold: minOverlap,
        totalWalletsWithAnyOverlap: overlapMap.size,
        maxHolderLimit: 150000
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}

