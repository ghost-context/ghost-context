// Server-side Alchemy contract metadata endpoint
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

    // Validate contract address
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

    const metadata = await alchemy.nft.getContractMetadata(contract);

    return Response.json({
      name: metadata.name || null,
      symbol: metadata.symbol || null,
      totalSupply: metadata.totalSupply || null,
      tokenType: metadata.tokenType || null,
      contractDeployer: metadata.contractDeployer || null,
      deployedBlockNumber: metadata.deployedBlockNumber || null,
      openSea: metadata.openSea || null,
    });

  } catch (error) {
    console.error('[alchemy/contract-metadata] error', { message: error.message, stack: error.stack?.slice(0, 500) });
    return new Response(
      JSON.stringify({ error: 'Failed to fetch contract metadata' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
