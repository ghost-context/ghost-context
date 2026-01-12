/**
 * Fetch JSON with standardized error handling
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options (headers, etc.)
 * @param {object} context - Context for error messages { name, identifier }
 * @returns {Promise<{ok: boolean, data?: any, error?: Response}>}
 */
export async function fetchJson(url, options = {}, context = {}) {
  const { name = 'API', identifier = '' } = context;

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[${name}] request`, { url, identifier });
  }

  try {
    const res = await fetch(url, options);

    if (!res.ok) {
      let bodyText = '';
      try { bodyText = await res.text(); } catch { bodyText = ''; }

      // Always log failures - Vercel captures these logs
      console.warn(`[${name}] failure`, { status: res.status, identifier, body: bodyText.slice(0, 500) });

      return {
        ok: false,
        error: new Response(
          JSON.stringify({ error: 'Lookup failed', identifier, status: res.status }),
          { status: res.status || 502, headers: { 'content-type': 'application/json' } }
        )
      };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (e) {
    // Always log errors - Vercel captures these logs
    console.error(`[${name}] error`, { identifier, message: e.message, stack: e.stack?.slice(0, 500) });
    return {
      ok: false,
      error: new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      )
    };
  }
}
