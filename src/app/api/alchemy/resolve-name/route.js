// Server-side ENS resolution endpoint using viem
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { normalize } from 'viem/ens';
import { validateOrigin } from '../../../lib/csrf.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const originError = validateOrigin(request);
  if (originError) return originError;

  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');

    if (!name) {
      return new Response(
        JSON.stringify({ error: 'Missing name parameter' }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }

    // Validate ENS name format
    if (!name.endsWith('.eth') || name.length <= 4) {
      return Response.json({ address: null });
    }

    const apiKey = process.env.ALCHEMY_ETH_API_KEY || process.env.NEXT_PUBLIC_ETH_MAIN_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }

    // Create viem public client with Alchemy RPC
    const client = createPublicClient({
      chain: mainnet,
      transport: http(`https://eth-mainnet.g.alchemy.com/v2/${apiKey}`),
    });

    // Normalize and resolve ENS name
    const normalizedName = normalize(name);
    const address = await client.getEnsAddress({ name: normalizedName });

    return Response.json({ address: address || null });

  } catch (error) {
    console.error('[alchemy/resolve-name] error', { message: error.message, stack: error.stack?.slice(0, 500) });
    return new Response(
      JSON.stringify({ error: 'Failed to resolve name' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
