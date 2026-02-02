// Server-side Alchemy collections endpoint
// Keeps API keys secure on server
import { Alchemy, Network } from 'alchemy-sdk';
import { validateAddressParam } from '../../../lib/validation.js';
import { validateOrigin } from '../../../lib/csrf.js';

export const dynamic = 'force-dynamic';

// Use same network keys as other endpoints (ETH_MAINNET format)
const NETWORK_CONFIG = {
  'ETH_MAINNET': { network: Network.ETH_MAINNET, name: 'Ethereum', key: () => process.env.ALCHEMY_ETH_API_KEY || process.env.NEXT_PUBLIC_ETH_MAIN_API_KEY },
  'MATIC_MAINNET': { network: Network.MATIC_MAINNET, name: 'Polygon', key: () => process.env.ALCHEMY_POLYGON_API_KEY || process.env.NEXT_PUBLIC_MATIC_MAIN_API_KEY },
  'ARB_MAINNET': { network: Network.ARB_MAINNET, name: 'Arbitrum', key: () => process.env.ALCHEMY_ARB_API_KEY || process.env.NEXT_PUBLIC_ARB_MAIN_API_KEY },
  'OPT_MAINNET': { network: Network.OPT_MAINNET, name: 'Optimism', key: () => process.env.ALCHEMY_OPT_API_KEY || process.env.NEXT_PUBLIC_OPT_MAIN_API_KEY },
  'BASE_MAINNET': { network: Network.BASE_MAINNET, name: 'Base', key: () => process.env.ALCHEMY_BASE_API_KEY || process.env.NEXT_PUBLIC_BASE_MAIN_API_KEY },
};

// Add Zora if supported
if (typeof Network.ZORA_MAINNET !== 'undefined') {
  NETWORK_CONFIG['ZORA_MAINNET'] = { network: Network.ZORA_MAINNET, name: 'Zora', key: () => process.env.ALCHEMY_ZORA_API_KEY || process.env.NEXT_PUBLIC_ZORA_MAIN_API_KEY };
}

// Fast collection fetching - uses getNftsForOwner which includes contract metadata
async function getCollectionsFast(address, networkKey, timeoutMs) {
  const config = NETWORK_CONFIG[networkKey];
  if (!config) return [];

  const apiKey = config.key();
  if (!apiKey) return [];

  const alchemy = new Alchemy({ apiKey, network: config.network });
  const collections = new Map();
  const startTime = Date.now();

  let pageKey = undefined;
  do {
    // Check timeout
    if (Date.now() - startTime > timeoutMs) {
      console.warn(`[collections] timeout on ${networkKey} after ${collections.size} contracts`);
      break;
    }

    const resp = await alchemy.nft.getNftsForOwner(address, {
      pageSize: 100,
      pageKey,
      omitMetadata: false,
    });

    for (const nft of resp.ownedNfts || []) {
      const contract = nft.contract?.address?.toLowerCase();
      if (!contract || collections.has(contract)) continue;

      // Extract metadata from the NFT response (no extra API calls)
      const contractData = nft.contract || {};
      const openSea = contractData.openSeaMetadata || {};

      collections.set(contract, {
        processed: true,
        network: networkKey,
        chains: [networkKey],
        networkName: config.name,
        name: contractData.name || openSea.collectionName || contract.slice(0, 10) + '...',
        description: openSea.description || contractData.description || '',
        image_small_url: openSea.imageUrl || contractData.image || '',
        distinct_owner_count: 0,
        contract_address: contract,
        token_type: contractData.tokenType || 'ERC721',
        large_collection: false,
        acquired_at: nft.timeLastUpdated || null,
        acquired_at_latest: nft.timeLastUpdated || null,
      });
    }

    pageKey = resp.pageKey;
  } while (pageKey);

  return Array.from(collections.values());
}

export async function GET(request) {
  const originError = validateOrigin(request);
  if (originError) return originError;

  try {
    const { searchParams } = new URL(request.url);
    const address = (searchParams.get('address') || '').trim().toLowerCase();
    const networksParam = searchParams.get('networks');

    const validationError = validateAddressParam(address);
    if (validationError) return validationError;

    // Parse networks or use all
    const networkKeys = networksParam
      ? networksParam.split(',')
      : Object.keys(NETWORK_CONFIG);

    // Fetch all networks in parallel with per-network timeout
    const NETWORK_TIMEOUT_MS = 5000; // 5s per network
    const startTime = Date.now();

    const results = await Promise.all(
      networkKeys.map(async (networkKey) => {
        try {
          return await getCollectionsFast(address, networkKey, NETWORK_TIMEOUT_MS);
        } catch (err) {
          console.error(`[collections] error on ${networkKey}:`, err.message);
          return [];
        }
      })
    );

    const collections = results.flat();
    const elapsed = Date.now() - startTime;

    return Response.json({
      collections,
      count: collections.length,
      elapsed,
    });

  } catch (error) {
    console.error('[alchemy/collections] error', { message: error.message, stack: error.stack?.slice(0, 500) });
    return new Response(
      JSON.stringify({ error: 'Failed to fetch collections' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
