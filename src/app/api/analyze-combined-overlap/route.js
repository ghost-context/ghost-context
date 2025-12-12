// 🎯 Unified Kindred Spirit Analysis
// Combines NFT collections, POAP events, and ERC-20 tokens
import { MoralisConfig } from '../../moralis-config.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const address = (body.address || '').trim().toLowerCase();
    const selectedNFTs = body.nfts || [];
    const selectedPOAPs = body.poaps || [];
    const selectedERC20s = body.erc20s || [];

    if (!address) {
      return new Response(
        JSON.stringify({ error: 'Missing address parameter' }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }

    const totalAssets = selectedNFTs.length + selectedPOAPs.length + selectedERC20s.length;
    if (totalAssets === 0) {
      return new Response(
        JSON.stringify({ error: 'No assets selected for analysis' }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }


    // Central overlap tracking
    const overlapMap = new Map(); // wallet -> { count, assets: { nfts: [], poaps: [], erc20s: [] } }

    // Helper to add overlap
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
    // 1. ANALYZE NFT COLLECTIONS (Alchemy)
    // ========================================
    if (selectedNFTs.length > 0) {
      for (const nft of selectedNFTs) {
        try {
          // Import AlchemyMultichainClient dynamically to avoid issues
          const { AlchemyMultichainClient } = await import('../../alchemy-multichain-client.js');
          const alchemy = new AlchemyMultichainClient();
          
          let owners = [];
          let pageKey = undefined;
          let pageCount = 0;
          
          do {
            const resp = await alchemy.forNetwork(nft.network).nft.getOwnersForContract(nft.address, { pageKey });
            const batch = resp?.owners || [];
            owners = owners.concat(batch);
            pageCount++;
            
            if (owners.length > 150000) {
              break;
            }
            pageKey = resp?.pageKey;
          } while (pageKey);

          for (const owner of owners) {
            // Handle both string and object formats from Alchemy SDK
            const ownerAddress = typeof owner === 'string' 
              ? owner 
              : (owner?.ownerAddress || owner);
            
            if (!ownerAddress) {
              continue;
            }
            
            addOverlap(ownerAddress.toLowerCase(), {
              address: nft.address,
              network: nft.network,
              name: nft.name,
              type: 'NFT'
            }, 'nft');
          }
        } catch (err) {
          // Silently skip failed NFTs
        }

        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
      }
    }

    // ========================================
    // 2. ANALYZE POAP EVENTS
    // ========================================
    if (selectedPOAPs.length > 0) {
      for (const poap of selectedPOAPs) {
        
        try {
          let page = 0;
          let pageCount = 0;
          let totalHolders = 0;

          do {
            const urlBase = typeof window === 'undefined' ? 'http://localhost:3000' : 'http://localhost:3000';
            const url = new URL('/api/poap/event', urlBase);
            url.searchParams.set('id', poap.eventId);
            url.searchParams.set('page', String(page));

            const res = await fetch(url.toString(), { cache: 'no-store' });
            if (!res.ok) {
              console.warn(`    ✗ Failed to fetch page ${page}`);
              break;
            }

            const data = await res.json();
            const holders = Array.isArray(data?.holders) ? data.holders : [];
            pageCount = holders.length;
            totalHolders += holders.length;

            for (const holder of holders) {
              addOverlap(holder.toLowerCase(), {
                eventId: poap.eventId,
                name: poap.name,
                type: 'POAP'
              }, 'poap');
            }

            page += 1;
            
            if (totalHolders >= 150000) {
              break;
            }
          } while (pageCount === 500);

        } catch (err) {
          // Silently skip failed POAPs
        }

        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
      }
    }

    // ========================================
    // 3. ANALYZE ERC-20 TOKENS (Moralis)
    // ========================================
    if (selectedERC20s.length > 0) {
      console.log(`\n🪙 Analyzing ${selectedERC20s.length} ERC-20 tokens for kindred spirits:`);
      console.log(`   Tokens:`, selectedERC20s.map(t => `${t.symbol} (${t.address.slice(0,8)}...)`).join(', '));
      
      // Log Moralis configuration
      console.log(`   📋 Moralis Config: Plan=${MoralisConfig.plan}, PageSize=${MoralisConfig.pageSize}, Delay=${MoralisConfig.delayMs}ms`);
      
      const apiKey = process.env.MORALIS_API_KEY || process.env.NEXT_PUBLIC_MORALIS_API_KEY;
      if (!apiKey) {
        console.log(`   ❌ ERROR: No Moralis API key found!`);
      }
      if (apiKey) {
        const baseUrl = 'https://deep-index.moralis.io/api/v2.2';
        const chains = ['base', '0x2105']; // Try Base network formats (name first, then hex)

        for (const token of selectedERC20s) {
          console.log(`\n   📊 Fetching holders for ${token.symbol}...`);
          
          let allOwners = [];
          let successfulChain = null;
          
          // Try each chain format until one works
          for (const chain of chains) {
            try {
              console.log(`      🔍 Trying chain format: ${chain} with limit=${MoralisConfig.pageSize}`);
              let cursor = null;
              let pageCount = 0;
              let chainOwners = [];

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

                if (!response.ok) {
                  const errorText = await response.text();
                  console.log(`      ⚠️  Chain ${chain} failed (${response.status}): ${errorText.substring(0, 100)}`);
                  break;
                }

                const data = await response.json();
                const owners = data.result || [];
                
                // If we get data, this chain format works
                if (pageCount === 0 && owners.length > 0) {
                  console.log(`      ✅ Chain format ${chain} works!`);
                  successfulChain = chain;
                }
                
                console.log(`      📄 Page ${pageCount + 1}: ${owners.length} owners fetched`);
                chainOwners = chainOwners.concat(owners);
                pageCount++;

                cursor = data.cursor || null;

                if (chainOwners.length > 150000) {
                  console.log(`      ⚠️  Reached 150k owner limit, stopping pagination`);
                  break;
                }

                if (cursor) {
                  await new Promise(resolve => setTimeout(resolve, MoralisConfig.delayMs));
                }
              } while (cursor);

              // If we got owners, use this chain and stop trying others
              if (chainOwners.length > 0) {
                allOwners = chainOwners;
                break;
              }
            } catch (err) {
              console.log(`      ⚠️  Chain ${chain} error: ${err.message}`);
            }
          }

          if (allOwners.length === 0) {
            console.log(`      ❌ No holders found for ${token.symbol} on any chain format`);
          } else {
            console.log(`      ✅ Found ${allOwners.length} holders for ${token.symbol} (chain: ${successfulChain})`);
            
            for (const owner of allOwners) {
              addOverlap(owner.owner_address.toLowerCase(), {
                address: token.address,
                symbol: token.symbol,
                name: token.name,
                balance: owner.balance_formatted,
                type: 'ERC-20'
              }, 'erc20');
            }
          }

          await new Promise(resolve => setTimeout(resolve, 200)); // Delay between tokens
        }
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

