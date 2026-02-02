import { NextResponse } from 'next/server';

// In-memory rate limit store
// NOTE: This resets on each serverless cold start. For production with
// high traffic, use @upstash/ratelimit with Vercel KV instead.
const rateLimit = new Map();

const WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS_API = 60; // 60 requests per minute for API
const MAX_REQUESTS_ANALYSIS = 10; // 10 analysis requests per minute (expensive)

// Clean old entries periodically
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60 * 1000;

function cleanOldEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  const windowStart = now - WINDOW_MS;
  for (const [key, timestamps] of rateLimit.entries()) {
    const recent = timestamps.filter(t => t > windowStart);
    if (recent.length === 0) {
      rateLimit.delete(key);
    } else {
      rateLimit.set(key, recent);
    }
  }
  lastCleanup = now;
}

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Only rate limit API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Skip health check
  if (pathname === '/api/health') {
    return NextResponse.next();
  }

  cleanOldEntries();

  const ip = request.ip ?? request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  // Determine rate limit based on endpoint
  const isAnalysisEndpoint = pathname.includes('analyze');
  const maxRequests = isAnalysisEndpoint ? MAX_REQUESTS_ANALYSIS : MAX_REQUESTS_API;
  const rateLimitKey = isAnalysisEndpoint ? `analysis:${ip}` : `api:${ip}`;

  // Get recent requests for this IP
  const requestLog = rateLimit.get(rateLimitKey) || [];
  const recentRequests = requestLog.filter(time => time > windowStart);

  if (recentRequests.length >= maxRequests) {
    console.warn('[RateLimit] Exceeded:', { ip, endpoint: pathname, count: recentRequests.length });
    return new NextResponse(
      JSON.stringify({
        error: 'Too many requests',
        retryAfter: Math.ceil((recentRequests[0] + WINDOW_MS - now) / 1000)
      }),
      {
        status: 429,
        headers: {
          'content-type': 'application/json',
          'Retry-After': String(Math.ceil((recentRequests[0] + WINDOW_MS - now) / 1000))
        }
      }
    );
  }

  // Log this request
  recentRequests.push(now);
  rateLimit.set(rateLimitKey, recentRequests);

  // Add rate limit headers to response
  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Limit', String(maxRequests));
  response.headers.set('X-RateLimit-Remaining', String(maxRequests - recentRequests.length));
  response.headers.set('X-RateLimit-Reset', String(Math.ceil((windowStart + WINDOW_MS) / 1000)));

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
