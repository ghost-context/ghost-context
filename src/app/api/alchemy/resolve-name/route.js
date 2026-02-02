// Server-side Alchemy ENS resolution endpoint
import { Alchemy, Network } from 'alchemy-sdk';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');

    if (!name) {
      return new Response(
        JSON.stringify({ error: 'Missing name parameter' }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }

    const apiKey = process.env.ALCHEMY_ETH_API_KEY || process.env.NEXT_PUBLIC_ETH_MAIN_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }

    const alchemy = new Alchemy({
      apiKey,
      network: Network.ETH_MAINNET,
    });

    const address = await alchemy.core.resolveName(name);

    return Response.json({ address: address || null });

  } catch (error) {
    console.error('[alchemy/resolve-name] error', { message: error.message, stack: error.stack?.slice(0, 500) });
    return new Response(
      JSON.stringify({ error: 'Failed to resolve name' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
