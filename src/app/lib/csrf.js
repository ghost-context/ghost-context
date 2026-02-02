// CSRF protection via Origin header validation
// Only allows requests from trusted origins

const ALLOWED_ORIGINS = [
  'https://ghost-context.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
];

/**
 * Validates that a request comes from an allowed origin.
 * Returns null if valid, or an error Response if invalid.
 *
 * @param {Request} request - The incoming request
 * @returns {Response|null} - Error response or null if valid
 */
export function validateOrigin(request) {
  const origin = request.headers.get('origin');

  // In development, be more permissive
  if (process.env.NODE_ENV === 'development') {
    return null;
  }

  // Origin header is required for cross-origin requests
  // Same-origin requests may not have it, so also check referer
  if (!origin) {
    const referer = request.headers.get('referer');
    if (referer) {
      try {
        const refererOrigin = new URL(referer).origin;
        if (ALLOWED_ORIGINS.includes(refererOrigin)) {
          return null;
        }
      } catch {
        // Invalid referer URL
      }
    }
    // If no origin and no valid referer, reject
    return new Response(
      JSON.stringify({ error: 'Missing origin header' }),
      { status: 403, headers: { 'content-type': 'application/json' } }
    );
  }

  if (!ALLOWED_ORIGINS.includes(origin)) {
    console.warn('[CSRF] Rejected request from origin:', origin);
    return new Response(
      JSON.stringify({ error: 'Invalid origin' }),
      { status: 403, headers: { 'content-type': 'application/json' } }
    );
  }

  return null;
}
