// Server-side Alchemy latest inbound transfer timestamp endpoint
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
    const owner = searchParams.get('owner');

    if (!network || !contract || !owner) {
      return new Response(
        JSON.stringify({ error: 'Missing network, contract, or owner parameter' }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }

    if (!NETWORK_MAP[network]) {
      return new Response(
        JSON.stringify({ error: 'Unsupported network' }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }

    // Validate addresses
    if (!/^0x[a-fA-F0-9]{40}$/.test(contract) || !/^0x[a-fA-F0-9]{40}$/.test(owner)) {
      return new Response(
        JSON.stringify({ error: 'Invalid address format' }),
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

    // Get asset transfers to the owner for this contract
    const response = await alchemy.core.getAssetTransfers({
      fromBlock: '0x0',
      toBlock: 'latest',
      toAddress: owner,
      contractAddresses: [contract],
      category: ['erc721', 'erc1155'],
      order: 'desc',
      maxCount: 1,
    });

    const transfers = response.transfers || [];
    if (transfers.length === 0) {
      return Response.json({ timestamp: null });
    }

    // Get block timestamp for the most recent transfer
    const blockNum = transfers[0].blockNum;
    const block = await alchemy.core.getBlock(parseInt(blockNum, 16));
    const timestamp = block ? new Date(block.timestamp * 1000).toISOString() : null;

    return Response.json({ timestamp });

  } catch (error) {
    console.error('[alchemy/latest-inbound] error', { message: error.message, stack: error.stack?.slice(0, 500) });
    return new Response(
      JSON.stringify({ error: 'Failed to fetch transfer timestamp' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
