# Security Hardening Design
*Created: 2026-01-09*
**Status: ✅ COMPLETED** (2026-02-01)

## Overview

Address security vulnerabilities in the current architecture, primarily around API key exposure and request validation.

**Estimated time:** 12-15 hours

## Current Security Issues

1. **API keys in browser bundle** - Alchemy, Neynar, Airstack keys are `NEXT_PUBLIC_*` and visible in client JS
2. **No rate limiting** - API routes can be hammered without throttling
3. **No CSRF protection** - POST endpoints don't validate origin
4. **Public key fallbacks** - Some server routes fall back to exposed keys (covered in quick-wins)

## Tasks

### 1. Move Alchemy Client-Side Calls to API Routes (~8-12h)

**Problem:** `AlchemyMultichainClient` runs entirely in the browser with `NEXT_PUBLIC_*` API keys. Anyone can extract these keys from the bundle.

**Current architecture:**
```
Browser                           External APIs
   │                                   │
   ├── AlchemyMultichainClient ───────►│ Alchemy (keys exposed)
   ├── AirStackClient ────────────────►│ Airstack (keys exposed)
   └── NeynarClient ──────────────────►│ Neynar (keys exposed)
```

**Target architecture:**
```
Browser                    Next.js API Routes         External APIs
   │                             │                         │
   ├── fetch('/api/alchemy/*') ─►│ AlchemyMultichainClient─►│ Alchemy
   ├── fetch('/api/airstack/*')─►│ AirStackClient ─────────►│ Airstack
   └── fetch('/api/neynar/*') ──►│ NeynarClient ───────────►│ Neynar
```

**Implementation steps:**

#### Step 1: Create Alchemy API routes

```
src/app/api/alchemy/
├── collections/route.js      # getCollectionsForOwner
├── owners-count/route.js     # getOwnersCountForContract
├── owners/route.js           # getOwnersForContract (paginated)
└── transfer/route.js         # getLatestInboundTransferTimestamp
```

**Example route:**
```javascript
// src/app/api/alchemy/collections/route.js
import { AlchemyMultichainClient } from '../../../alchemy-multichain-client';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  // Validate address
  const validationError = validateAddressParam(address);
  if (validationError) return validationError;

  // Create client with server-side keys
  const client = new AlchemyMultichainClient({
    eth: process.env.ALCHEMY_ETH_API_KEY,
    polygon: process.env.ALCHEMY_POLYGON_API_KEY,
    // ... etc
  });

  const collections = await client.getCollectionsForOwner(address);
  return Response.json({ collections });
}
```

#### Step 2: Update AlchemyMultichainClient

Modify to accept API keys via constructor instead of reading from `process.env.NEXT_PUBLIC_*`:

```javascript
class AlchemyMultichainClient {
  constructor(apiKeys) {
    this.settings = {
      [Network.ETH_MAINNET]: { apiKey: apiKeys.eth },
      [Network.MATIC_MAINNET]: { apiKey: apiKeys.polygon },
      // ...
    };
  }
}
```

#### Step 3: Create client-side fetch wrapper

```javascript
// src/app/lib/alchemy-api.js (client-side)
export async function getCollectionsForOwner(address, progressCallback) {
  const res = await fetch(`/api/alchemy/collections?address=${address}`);
  if (!res.ok) throw new Error('Failed to fetch collections');
  return res.json();
}

export async function getOwnersCountForContract(network, contract, maxCount) {
  const res = await fetch(`/api/alchemy/owners-count?network=${network}&contract=${contract}&maxCount=${maxCount}`);
  if (!res.ok) throw new Error('Failed to fetch owner count');
  return res.json();
}
```

#### Step 4: Update components

Update all components that currently use `AlchemyMultichainClient` directly:
- `src/app/components/NftTableList.js`
- `src/app/components/KindredSpiritsList.js`
- `src/app/page.js`

**Environment variable changes:**
```bash
# Remove from .env.local (client-exposed)
NEXT_PUBLIC_ETH_MAIN_API_KEY=xxx
NEXT_PUBLIC_MATIC_MAIN_API_KEY=xxx

# Add to .env.local (server-only)
ALCHEMY_ETH_API_KEY=xxx
ALCHEMY_POLYGON_API_KEY=xxx
```

---

### 2. Add Rate Limiting Middleware (~2h)

**Problem:** API routes have no rate limiting. Malicious actors could hammer endpoints.

**Solution:** Use Vercel Edge Middleware with in-memory or KV-based rate limiting.

```javascript
// middleware.js
import { NextResponse } from 'next/server';

const rateLimit = new Map();
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 60; // 60 requests per minute

export function middleware(request) {
  // Only rate limit API routes
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const ip = request.ip ?? request.headers.get('x-forwarded-for') ?? 'unknown';
  const now = Date.now();

  // Clean old entries
  const windowStart = now - WINDOW_MS;
  const requestLog = rateLimit.get(ip) || [];
  const recentRequests = requestLog.filter(time => time > windowStart);

  if (recentRequests.length >= MAX_REQUESTS) {
    return new NextResponse(
      JSON.stringify({ error: 'Too many requests' }),
      { status: 429, headers: { 'content-type': 'application/json' } }
    );
  }

  recentRequests.push(now);
  rateLimit.set(ip, recentRequests);

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
```

**Note:** For production with multiple serverless instances, use `@vercel/kv` or `@upstash/ratelimit` instead of in-memory Map.

---

### 3. Add CSRF Protection (~1h)

**Problem:** POST endpoints don't validate that requests come from our domain.

**Solution:** Validate `Origin` header on POST requests.

```javascript
// src/app/lib/csrf.js
export function validateOrigin(request) {
  const origin = request.headers.get('origin');
  const allowedOrigins = [
    'https://ghost-context.vercel.app',
    'http://localhost:3000',
  ];

  if (!origin || !allowedOrigins.includes(origin)) {
    return new Response(
      JSON.stringify({ error: 'Invalid origin' }),
      { status: 403, headers: { 'content-type': 'application/json' } }
    );
  }
  return null;
}
```

**Usage in POST routes:**
```javascript
// src/app/api/analyze-combined-overlap/route.js
import { validateOrigin } from '../../lib/csrf.js';

export async function POST(request) {
  const originError = validateOrigin(request);
  if (originError) return originError;

  // ... rest of handler
}
```

**Files to update:**
- `src/app/api/analyze-combined-overlap/route.js`
- `src/app/api/analyze-erc20-overlap/route.js`
- Any other POST endpoints

---

## Checklist

### Phase 1: Rate Limiting & CSRF (3h)
- [ ] Create `middleware.js` with rate limiting
- [ ] Create `src/app/lib/csrf.js`
- [ ] Add CSRF validation to POST endpoints
- [ ] Test rate limiting locally
- [ ] Test CSRF rejection

### Phase 2: Alchemy Migration (8-12h)
- [ ] Create `src/app/api/alchemy/collections/route.js`
- [ ] Create `src/app/api/alchemy/owners-count/route.js`
- [ ] Create `src/app/api/alchemy/owners/route.js`
- [ ] Create `src/app/api/alchemy/transfer/route.js`
- [ ] Modify `AlchemyMultichainClient` to accept keys via constructor
- [ ] Create `src/app/lib/alchemy-api.js` client wrapper
- [ ] Update `NftTableList.js` to use new API
- [ ] Update `KindredSpiritsList.js` to use new API
- [ ] Update `page.js` to use new API
- [ ] Remove `NEXT_PUBLIC_*` Alchemy keys from env
- [ ] Add server-side Alchemy keys to env
- [ ] Test all collection fetching flows
- [ ] Test owner counting flows
- [ ] Verify no client-side API key exposure

## Success Criteria

- No API keys visible in browser bundle (`NEXT_PUBLIC_*` removed)
- Rate limiting returns 429 after threshold exceeded
- POST requests from foreign origins return 403
- All existing functionality still works
- Build passes
