// Server-side Alchemy owner count endpoint
import { Network } from 'alchemy-sdk';
import { AlchemyMultichainClient } from '../../../alchemy-multichain-client.js';

export const dynamic = 'force-dynamic';

function getServerAlchemyClient() {
  const settings = {
    apiKey: process.env.ALCHEMY_ETH_API_KEY || process.env.NEXT_PUBLIC_ETH_MAIN_API_KEY,
    network: Network.ETH_MAINNET,
  };

  const overrides = {
    [Network.MATIC_MAINNET]: { apiKey: process.env.ALCHEMY_POLYGON_API_KEY || process.env.NEXT_PUBLIC_MATIC_MAIN_API_KEY },
    [Network.ARB_MAINNET]: { apiKey: process.env.ALCHEMY_ARB_API_KEY || process.env.NEXT_PUBLIC_ARB_MAIN_API_KEY },
    [Network.OPT_MAINNET]: { apiKey: process.env.ALCHEMY_OPT_API_KEY || process.env.NEXT_PUBLIC_OPT_MAIN_API_KEY },
    [Network.BASE_MAINNET]: { apiKey: process.env.ALCHEMY_BASE_API_KEY || process.env.NEXT_PUBLIC_BASE_MAIN_API_KEY },
  };

  if (typeof Network.ZORA_MAINNET !== 'undefined') {
    overrides[Network.ZORA_MAINNET] = { apiKey: process.env.ALCHEMY_ZORA_API_KEY || process.env.NEXT_PUBLIC_ZORA_MAIN_API_KEY };
  }

  return new AlchemyMultichainClient(settings, overrides);
}

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

    // Validate contract address format (skip for POAP which uses event IDs)
    if (network !== 'POAP' && !/^0x[a-fA-F0-9]{40}$/.test(contract)) {
      return new Response(
        JSON.stringify({ error: 'Invalid contract address format' }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }

    const client = getServerAlchemyClient();
    const ownerCount = await client.getOwnersCountForContract(network, contract, maxCount);

    return Response.json({ ownerCount });

  } catch (error) {
    console.error('[alchemy/owners-count] error', { message: error.message, stack: error.stack?.slice(0, 500) });
    return new Response(
      JSON.stringify({ error: 'Failed to fetch owner count' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
