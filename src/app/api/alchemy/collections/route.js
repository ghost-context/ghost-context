// Server-side Alchemy collections endpoint
// Keeps API keys secure on server
import { Network } from 'alchemy-sdk';
import { AlchemyMultichainClient } from '../../../alchemy-multichain-client.js';
import { validateAddressParam } from '../../../lib/validation.js';

export const dynamic = 'force-dynamic';

// Server-side API keys (not exposed to browser)
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

  // Add Zora if available
  if (typeof Network.ZORA_MAINNET !== 'undefined') {
    overrides[Network.ZORA_MAINNET] = { apiKey: process.env.ALCHEMY_ZORA_API_KEY || process.env.NEXT_PUBLIC_ZORA_MAIN_API_KEY };
  }

  return new AlchemyMultichainClient(settings, overrides);
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = (searchParams.get('address') || '').trim().toLowerCase();
    const filter = searchParams.get('filter') || 'relevant';
    const networksParam = searchParams.get('networks'); // comma-separated

    // Validate address
    const validationError = validateAddressParam(address);
    if (validationError) return validationError;

    // Parse networks if provided
    const networks = networksParam ? networksParam.split(',') : null;

    // Create client with server-side keys
    const client = getServerAlchemyClient();

    const collections = await client.getCollectionsForOwner(
      address,
      filter,
      () => {}, // No progress callback for API route
      networks
    );

    return Response.json({
      collections,
      count: collections.length
    });

  } catch (error) {
    console.error('[alchemy/collections] error', { message: error.message, stack: error.stack?.slice(0, 500) });
    return new Response(
      JSON.stringify({ error: 'Failed to fetch collections' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
