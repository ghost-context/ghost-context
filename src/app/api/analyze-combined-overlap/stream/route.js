// Streaming endpoint for real-time analysis progress via Server-Sent Events
import { MoralisConfig } from '../../../moralis-config.js';
import { validateAddressParam } from '../../../lib/validation.js';
import { TopK } from '../../../lib/top-k.js';
import { fetchWithRetry } from '../../../lib/fetch-with-retry.js';
import { validateOrigin } from '../../../lib/csrf.js';

export async function POST(request) {
  // CSRF protection
  const originError = validateOrigin(request);
  if (originError) return originError;

  const body = await request.json();
  const address = (body.address || '').trim().toLowerCase();
  const selectedNFTs = body.nfts || [];
  const selectedPOAPs = body.poaps || [];
  const selectedERC20s = body.erc20s || [];

  // Validate
  const validationError = validateAddressParam(address);
  if (validationError) return validationError;

  const totalAssets = selectedNFTs.length + selectedPOAPs.length + selectedERC20s.length;
  if (totalAssets === 0) {
    return new Response(
      JSON.stringify({ error: 'No assets selected' }),
      { status: 400, headers: { 'content-type': 'application/json' } }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const overlapMap = new Map();

        const addOverlap = (walletAddress, assetInfo, assetType) => {
          if (walletAddress.toLowerCase() === address) return;
          if (!overlapMap.has(walletAddress)) {
            overlapMap.set(walletAddress, { count: 0, assets: { nfts: [], poaps: [], erc20s: [] } });
          }
          const overlap = overlapMap.get(walletAddress);
          const assetKey = assetType === 'poap' ? assetInfo.eventId : assetInfo.address;
          const alreadyCounted = overlap.assets[`${assetType}s`].some(a =>
            (assetType === 'poap' ? a.eventId : a.address) === assetKey
          );
          if (!alreadyCounted) {
            overlap.count += 1;
            overlap.assets[`${assetType}s`].push(assetInfo);
          }
        };

        // Phase 1: NFTs
        if (selectedNFTs.length > 0) {
          send({ type: 'progress', phase: 'NFT holders', current: 0, total: selectedNFTs.length });
          for (let i = 0; i < selectedNFTs.length; i++) {
            const nft = selectedNFTs[i];
            try {
              const { AlchemyMultichainClient } = await import('../../../alchemy-multichain-client.js');
              const alchemy = new AlchemyMultichainClient();
              let owners = [];
              let pageKey;
              do {
                const resp = await alchemy.forNetwork(nft.network).nft.getOwnersForContract(nft.address, { pageKey });
                owners = owners.concat(resp?.owners || []);
                if (owners.length > 150000) break;
                pageKey = resp?.pageKey;
              } while (pageKey);

              for (const owner of owners) {
                const addr = typeof owner === 'string' ? owner : owner?.ownerAddress;
                if (addr) addOverlap(addr.toLowerCase(), { address: nft.address, network: nft.network, name: nft.name, type: 'NFT' }, 'nft');
              }
            } catch (err) {
              console.warn(`Failed to fetch NFT owners for ${nft.address}:`, err.message);
            }
            send({ type: 'progress', phase: 'NFT holders', current: i + 1, total: selectedNFTs.length });
          }
        }

        // Phase 2: POAPs
        if (selectedPOAPs.length > 0) {
          send({ type: 'progress', phase: 'POAP holders', current: 0, total: selectedPOAPs.length });
          for (let i = 0; i < selectedPOAPs.length; i++) {
            const poap = selectedPOAPs[i];
            try {
              let allHolders = [];
              let page = 0;
              let pageCount = 0;
              do {
                const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
                const res = await fetch(`${baseUrl}/api/poap/event?id=${poap.eventId}&page=${page}`);
                if (!res.ok) break;
                const data = await res.json();
                const holders = data?.holders || [];
                pageCount = holders.length;
                allHolders = allHolders.concat(holders);
                page++;
                if (allHolders.length >= 150000) break;
              } while (pageCount === 500);

              for (const holder of allHolders) {
                addOverlap(holder.toLowerCase(), { eventId: poap.eventId, name: poap.name, type: 'POAP' }, 'poap');
              }
            } catch (err) {
              console.warn(`Failed to fetch POAP holders for ${poap.eventId}:`, err.message);
            }
            send({ type: 'progress', phase: 'POAP holders', current: i + 1, total: selectedPOAPs.length });
          }
        }

        // Phase 3: ERC-20s
        const apiKey = process.env.MORALIS_API_KEY;
        if (selectedERC20s.length > 0 && apiKey) {
          send({ type: 'progress', phase: 'ERC-20 holders', current: 0, total: selectedERC20s.length });
          for (let i = 0; i < selectedERC20s.length; i++) {
            const token = selectedERC20s[i];
            try {
              let allOwners = [];
              let cursor = null;
              do {
                const params = new URLSearchParams({ chain: '0x2105', limit: String(MoralisConfig.pageSize) });
                if (cursor) params.set('cursor', cursor);
                const response = await fetchWithRetry(
                  `https://deep-index.moralis.io/api/v2.2/erc20/${token.address}/owners?${params}`,
                  { headers: { 'accept': 'application/json', 'X-API-Key': apiKey } },
                  { maxRetries: 2 }
                );
                if (!response.ok) break;
                const data = await response.json();
                allOwners = allOwners.concat(data.result || []);
                cursor = data.cursor;
                if (allOwners.length > 150000) break;
              } while (cursor);

              for (const owner of allOwners) {
                addOverlap(owner.owner_address.toLowerCase(), { address: token.address, symbol: token.symbol, name: token.name, type: 'ERC-20' }, 'erc20');
              }
            } catch (err) {
              console.warn(`Failed to fetch ERC-20 owners for ${token.address}:`, err.message);
            }
            send({ type: 'progress', phase: 'ERC-20 holders', current: i + 1, total: selectedERC20s.length });
          }
        }

        // Phase 4: Calculate results
        send({ type: 'progress', phase: 'Calculating results', current: 0, total: 1 });

        const minOverlap = totalAssets >= 2 ? 2 : 1;
        const topK = new TopK(100, (a, b) => a.overlapCount - b.overlapCount);

        for (const [wallet, data] of overlapMap.entries()) {
          if (data.count >= minOverlap) {
            topK.push({
              address: wallet,
              overlapCount: data.count,
              overlapPercentage: ((data.count / totalAssets) * 100).toFixed(1),
              sharedAssets: data.assets,
              totalShared: data.count
            });
          }
        }

        send({ type: 'progress', phase: 'Calculating results', current: 1, total: 1 });

        // Send final results
        send({
          type: 'result',
          success: true,
          walletAddress: address,
          analyzedAssets: { nfts: selectedNFTs.length, poaps: selectedPOAPs.length, erc20s: selectedERC20s.length, total: totalAssets },
          kindredSpirits: topK.getResults(),
          totalKindredSpirits: topK.size,
          minOverlapThreshold: minOverlap,
          totalWalletsWithAnyOverlap: overlapMap.size
        });

      } catch (error) {
        send({ type: 'error', message: error.message });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
