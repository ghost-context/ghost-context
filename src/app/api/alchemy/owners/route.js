// Server-side Alchemy owners list endpoint (paginated)
import { Alchemy, Network } from 'alchemy-sdk';
import { validateOrigin } from '../../../lib/csrf.js';

export const dynamic = 'force-dynamic';

const NETWORK_MAP = {
  'ETH_MAINNET': Network.ETH_MAINNET,
  'MATIC_MAINNET': Network.MATIC_MAINNET,
  'ARB_MAINNET': Network.ARB_MAINNET,
  'OPT_MAINNET': Network.OPT_MAINNET,
  'BASE_MAINNET': Network.BASE_MAINNET,
  // Lowercase aliases for compatibility
  'eth-mainnet': Network.ETH_MAINNET,
  'matic-mainnet': Network.MATIC_MAINNET,
  'arb-mainnet': Network.ARB_MAINNET,
  'opt-mainnet': Network.OPT_MAINNET,
  'base-mainnet': Network.BASE_MAINNET,
};

// Add ZORA if available
if (typeof Network.ZORA_MAINNET !== 'undefined') {
  NETWORK_MAP['ZORA_MAINNET'] = Network.ZORA_MAINNET;
  NETWORK_MAP['zora-mainnet'] = Network.ZORA_MAINNET;
}

const API_KEY_MAP = {
  'ETH_MAINNET': () => process.env.ALCHEMY_ETH_API_KEY || process.env.NEXT_PUBLIC_ETH_MAIN_API_KEY,
  'MATIC_MAINNET': () => process.env.ALCHEMY_POLYGON_API_KEY || process.env.NEXT_PUBLIC_MATIC_MAIN_API_KEY,
  'ARB_MAINNET': () => process.env.ALCHEMY_ARB_API_KEY || process.env.NEXT_PUBLIC_ARB_MAIN_API_KEY,
  'OPT_MAINNET': () => process.env.ALCHEMY_OPT_API_KEY || process.env.NEXT_PUBLIC_OPT_MAIN_API_KEY,
  'BASE_MAINNET': () => process.env.ALCHEMY_BASE_API_KEY || process.env.NEXT_PUBLIC_BASE_MAIN_API_KEY,
  'ZORA_MAINNET': () => process.env.ALCHEMY_ZORA_API_KEY || process.env.NEXT_PUBLIC_ZORA_MAIN_API_KEY,
  // Lowercase aliases
  'eth-mainnet': () => process.env.ALCHEMY_ETH_API_KEY || process.env.NEXT_PUBLIC_ETH_MAIN_API_KEY,
  'matic-mainnet': () => process.env.ALCHEMY_POLYGON_API_KEY || process.env.NEXT_PUBLIC_MATIC_MAIN_API_KEY,
  'arb-mainnet': () => process.env.ALCHEMY_ARB_API_KEY || process.env.NEXT_PUBLIC_ARB_MAIN_API_KEY,
  'opt-mainnet': () => process.env.ALCHEMY_OPT_API_KEY || process.env.NEXT_PUBLIC_OPT_MAIN_API_KEY,
  'base-mainnet': () => process.env.ALCHEMY_BASE_API_KEY || process.env.NEXT_PUBLIC_BASE_MAIN_API_KEY,
  'zora-mainnet': () => process.env.ALCHEMY_ZORA_API_KEY || process.env.NEXT_PUBLIC_ZORA_MAIN_API_KEY,
};

export async function GET(request) {
  const originError = validateOrigin(request);
  if (originError) return originError;

  try {
    const { searchParams } = new URL(request.url);
    const network = searchParams.get('network');
    const contract = searchParams.get('contract');
    const pageKey = searchParams.get('pageKey') || undefined;

    if (!network || !contract) {
      return new Response(
        JSON.stringify({ error: 'Missing network or contract parameter' }),
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

    const result = await alchemy.nft.getOwnersForContract(contract, { pageKey });

    return Response.json({
      owners: result.owners || [],
      pageKey: result.pageKey || null,
    });

  } catch (error) {
    console.error('[alchemy/owners] error', { message: error.message, stack: error.stack?.slice(0, 500) });
    return new Response(
      JSON.stringify({ error: 'Failed to fetch owners' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
