// Fast endpoint: Just fetch tokens WITHOUT holder count filtering
// Used for common assets analysis where we only need token addresses, not filtering
import { validateAddressParam } from '../../lib/validation.js';

// Tell Next.js this route is always dynamic (uses request.url)
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = (searchParams.get('address') || '').trim().toLowerCase();

    // Validate address format
    const validationError = validateAddressParam(address);
    if (validationError) return validationError;

    const apiKey = process.env.MORALIS_API_KEY || process.env.NEXT_PUBLIC_MORALIS_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Moralis API key not configured' }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }

    const baseUrl = 'https://deep-index.moralis.io/api/v2.2';
    const chains = ['0x2105', '8453', 'base'];

    // Just get wallet's ERC-20 tokens (no filtering)
    let tokensData = null;
    let chain = null;

    for (const chainFormat of chains) {
      const tokensUrl = `${baseUrl}/${address}/erc20?chain=${chainFormat}`;
      
      const tokensResponse = await fetch(tokensUrl, {
        headers: { 'Accept': 'application/json', 'X-API-Key': apiKey }
      });

      if (tokensResponse.ok) {
        const data = await tokensResponse.json();
        
        if (data && (data.result?.length > 0 || (Array.isArray(data) && data.length > 0))) {
          tokensData = data;
          chain = chainFormat;
          break;
        }
      }
    }

    if (!tokensData || !chain) {
      return new Response(
        JSON.stringify({ 
          tokens: [],
          count: 0
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    // Handle both response formats: direct array or {result: [...]}
    const allTokens = Array.isArray(tokensData) ? tokensData : (tokensData.result || []);

    // Return tokens WITHOUT checking holder counts (much faster!)
    const tokens = allTokens.map(token => ({
      address: token.token_address,
      symbol: token.symbol || 'UNKNOWN',
      name: token.name || 'Unknown Token',
      balance: token.balance_formatted || '0',
      logo: token.logo || token.thumbnail || null,
      usdValue: token.usd_value || null
    }));

    return new Response(
      JSON.stringify({
        tokens,
        count: tokens.length,
        chain
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Fast Tokens] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}


