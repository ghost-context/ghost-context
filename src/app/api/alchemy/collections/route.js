// Server-side Alchemy collections endpoint
// Keeps API keys secure on server
import { Network } from 'alchemy-sdk';
import { AlchemyMultichainClient } from '../../../alchemy-multichain-client.js';
import { validateAddressParam } from '../../../lib/validation.js';
import { validateOrigin } from '../../../lib/csrf.js';

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
  const originError = validateOrigin(request);
  if (originError) return originError;

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

    // Fetch networks one at a time to avoid timeout
    // Return partial results if we run out of time
    const TIMEOUT_MS = 8000;
    const startTime = Date.now();

    const allNetworks = networks || client.getAllNetworks();
    const collections = [];
    const completedNetworks = [];
    let partial = false;

    for (const network of allNetworks) {
      // Check if we're running low on time
      if (Date.now() - startTime > TIMEOUT_MS) {
        partial = true;
        console.warn('[alchemy/collections] timeout after networks:', completedNetworks);
        break;
      }

      try {
        const networkCollections = await client.getCollectionsForOwner(
          address,
          filter,
          () => {},
          [network]
        );
        collections.push(...networkCollections);
        completedNetworks.push(network);
      } catch (err) {
        console.error('[alchemy/collections] error on network:', network, err.message);
        // Continue with other networks
      }
    }

    return Response.json({
      collections,
      count: collections.length,
      partial,
      completedNetworks
    });

  } catch (error) {
    console.error('[alchemy/collections] error', { message: error.message, stack: error.stack?.slice(0, 500) });
    return new Response(
      JSON.stringify({ error: 'Failed to fetch collections' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
