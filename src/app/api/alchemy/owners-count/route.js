// Server-side Alchemy owner count endpoint
import { Alchemy, Network } from 'alchemy-sdk';

export const dynamic = 'force-dynamic';

const NETWORK_MAP = {
  'ETH_MAINNET': Network.ETH_MAINNET,
  'MATIC_MAINNET': Network.MATIC_MAINNET,
  'ARB_MAINNET': Network.ARB_MAINNET,
  'OPT_MAINNET': Network.OPT_MAINNET,
  'BASE_MAINNET': Network.BASE_MAINNET,
};

if (typeof Network.ZORA_MAINNET !== 'undefined') {
  NETWORK_MAP['ZORA_MAINNET'] = Network.ZORA_MAINNET;
}

const API_KEY_MAP = {
  'ETH_MAINNET': () => process.env.ALCHEMY_ETH_API_KEY || process.env.NEXT_PUBLIC_ETH_MAIN_API_KEY,
  'MATIC_MAINNET': () => process.env.ALCHEMY_POLYGON_API_KEY || process.env.NEXT_PUBLIC_MATIC_MAIN_API_KEY,
  'ARB_MAINNET': () => process.env.ALCHEMY_ARB_API_KEY || process.env.NEXT_PUBLIC_ARB_MAIN_API_KEY,
  'OPT_MAINNET': () => process.env.ALCHEMY_OPT_API_KEY || process.env.NEXT_PUBLIC_OPT_MAIN_API_KEY,
  'BASE_MAINNET': () => process.env.ALCHEMY_BASE_API_KEY || process.env.NEXT_PUBLIC_BASE_MAIN_API_KEY,
  'ZORA_MAINNET': () => process.env.ALCHEMY_ZORA_API_KEY || process.env.NEXT_PUBLIC_ZORA_MAIN_API_KEY,
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const network = searchParams.get('network');
    const contract = searchParams.get('contract');
    const maxCount = parseInt(searchParams.get('maxCount') || '25000', 10);

    if (!network || !contract) {
      return new Response(
        JSON.stringify({ error: 'Missing network or contract parameter' }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }

    // Handle POAP separately (uses event IDs, not contract addresses)
    if (network === 'POAP') {
      // POAP owner counts are fetched via the POAP API, not Alchemy
      return new Response(
        JSON.stringify({ error: 'Use /api/poap/event for POAP owner counts' }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }

    if (!NETWORK_MAP[network]) {
      return new Response(
        JSON.stringify({ error: 'Unsupported network' }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }

    // Validate contract address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(contract)) {
      return new Response(
        JSON.stringify({ error: 'Invalid contract address format' }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }

    const apiKey = API_KEY_MAP[network]?.();
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key not configured for network' }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }

    const alchemy = new Alchemy({
      apiKey,
      network: NETWORK_MAP[network],
    });

    // Count owners with pagination up to maxCount
    let total = 0;
    let pageKey = undefined;
    do {
      const resp = await alchemy.nft.getOwnersForContract(contract, { pageKey });
      const owners = resp?.owners || [];
      total += owners.length;
      if (total >= maxCount) {
        return Response.json({ ownerCount: total });
      }
      pageKey = resp.pageKey;
    } while (pageKey);

    return Response.json({ ownerCount: total });

  } catch (error) {
    console.error('[alchemy/owners-count] error', { message: error.message, stack: error.stack?.slice(0, 500) });
    return new Response(
      JSON.stringify({ error: 'Failed to fetch owner count' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
