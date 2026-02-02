# Security Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove API key exposure from browser bundle, add rate limiting, and add CSRF protection.

**Architecture:** Move all Alchemy SDK calls from client-side to Next.js API routes. Create middleware for rate limiting. Add origin validation to POST endpoints.

**Tech Stack:** Next.js 14 App Router, Alchemy SDK, Vercel Edge Middleware, Vercel KV (optional)

**Design Doc:** `docs/plans/2026-01-09-security-hardening-design.md`

---

## Phase 1: Quick Security Fixes (30 min)

### Task 1: Remove Moralis NEXT_PUBLIC Fallback

**Files:**
- Modify: `src/app/api/analyze-combined-overlap/route.js:138`
- Modify: `src/app/api/analyze-erc20-overlap/route.js:24`

**Step 1: Fix analyze-combined-overlap**

Open `src/app/api/analyze-combined-overlap/route.js` and find line 138:
```javascript
const apiKey = process.env.MORALIS_API_KEY || process.env.NEXT_PUBLIC_MORALIS_API_KEY;
```

Change to:
```javascript
const apiKey = process.env.MORALIS_API_KEY;
```

**Step 2: Fix analyze-erc20-overlap**

Open `src/app/api/analyze-erc20-overlap/route.js` and find line 24:
```javascript
const apiKey = process.env.MORALIS_API_KEY || process.env.NEXT_PUBLIC_MORALIS_API_KEY;
```

Change to:
```javascript
const apiKey = process.env.MORALIS_API_KEY;
```

**Step 3: Build to verify**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/app/api/analyze-combined-overlap/route.js src/app/api/analyze-erc20-overlap/route.js
git commit -m "fix(security): remove NEXT_PUBLIC Moralis API key fallback"
```

---

### Task 2: Fix Error Message Information Disclosure

**Files:**
- Modify: `src/app/api/analyze-combined-overlap/route.js:308-312`
- Modify: `src/app/api/analyze-erc20-overlap/route.js:142-146`

**Step 1: Fix analyze-combined-overlap error handler**

Find the catch block at end of file (around line 308):
```javascript
} catch (error) {
  return new Response(
    JSON.stringify({ error: error.message }),
    { status: 500, headers: { 'content-type': 'application/json' } }
  );
}
```

Change to:
```javascript
} catch (error) {
  console.error('[analyze-combined-overlap] error', { message: error.message, stack: error.stack?.slice(0, 500) });
  return new Response(
    JSON.stringify({ error: 'Internal server error' }),
    { status: 500, headers: { 'content-type': 'application/json' } }
  );
}
```

**Step 2: Fix analyze-erc20-overlap error handler**

Find the catch block at end of file (around line 142):
```javascript
} catch (error) {
  return new Response(
    JSON.stringify({ error: error.message }),
    { status: 500, headers: { 'content-type': 'application/json' } }
  );
}
```

Change to:
```javascript
} catch (error) {
  console.error('[analyze-erc20-overlap] error', { message: error.message, stack: error.stack?.slice(0, 500) });
  return new Response(
    JSON.stringify({ error: 'Internal server error' }),
    { status: 500, headers: { 'content-type': 'application/json' } }
  );
}
```

**Step 3: Build to verify**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/app/api/analyze-combined-overlap/route.js src/app/api/analyze-erc20-overlap/route.js
git commit -m "fix(security): genericize error messages to prevent info disclosure"
```

---

## Phase 2: CSRF Protection (1 hour)

### Task 3: Create CSRF Validation Utility

**Files:**
- Create: `src/app/lib/csrf.js`

**Step 1: Create the utility**

Create `src/app/lib/csrf.js`:

```javascript
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
```

**Step 2: Build to verify syntax**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/lib/csrf.js
git commit -m "feat(security): add CSRF origin validation utility"
```

---

### Task 4: Add CSRF Protection to POST Endpoints

**Files:**
- Modify: `src/app/api/analyze-combined-overlap/route.js`
- Modify: `src/app/api/analyze-combined-overlap/stream/route.js`
- Modify: `src/app/api/analyze-erc20-overlap/route.js`

**Step 1: Update analyze-combined-overlap/route.js**

Add import at top of file:
```javascript
import { validateOrigin } from '../../lib/csrf.js';
```

Add validation at start of POST handler (after `export async function POST(request) {`):
```javascript
  // CSRF protection
  const originError = validateOrigin(request);
  if (originError) return originError;
```

**Step 2: Update analyze-combined-overlap/stream/route.js**

Add import at top of file:
```javascript
import { validateOrigin } from '../../../lib/csrf.js';
```

Add validation at start of POST handler:
```javascript
  // CSRF protection
  const originError = validateOrigin(request);
  if (originError) return originError;
```

**Step 3: Update analyze-erc20-overlap/route.js**

Add import at top of file:
```javascript
import { validateOrigin } from '../../lib/csrf.js';
```

Add validation at start of POST handler:
```javascript
  // CSRF protection
  const originError = validateOrigin(request);
  if (originError) return originError;
```

**Step 4: Build to verify**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Test locally**

Run: `npm run dev`

Test with curl (should be rejected in production mode):
```bash
curl -X POST http://localhost:3000/api/analyze-combined-overlap \
  -H "Content-Type: application/json" \
  -H "Origin: https://evil-site.com" \
  -d '{"address":"0x1234"}'
```
Expected in dev: Request proceeds (dev mode is permissive)

**Step 6: Commit**

```bash
git add src/app/api/analyze-combined-overlap/route.js \
        src/app/api/analyze-combined-overlap/stream/route.js \
        src/app/api/analyze-erc20-overlap/route.js
git commit -m "feat(security): add CSRF protection to POST endpoints"
```

---

## Phase 3: Rate Limiting (2 hours)

### Task 5: Create Rate Limiting Middleware

**Files:**
- Create: `middleware.js` (root of project)

**Step 1: Create middleware**

Create `middleware.js` in project root:

```javascript
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
```

**Step 2: Build to verify**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Test locally**

Run: `npm run dev`

Test rapid requests:
```bash
for i in {1..15}; do
  curl -s http://localhost:3000/api/health | head -c 50
  echo " ($i)"
done
```
Expected: Requests succeed (health is exempt)

Test analysis rate limit:
```bash
for i in {1..12}; do
  curl -s -X POST http://localhost:3000/api/analyze-combined-overlap \
    -H "Content-Type: application/json" \
    -d '{"address":"0x1234"}' | head -c 100
  echo " ($i)"
done
```
Expected: First 10 succeed, then 429 errors

**Step 4: Commit**

```bash
git add middleware.js
git commit -m "feat(security): add rate limiting middleware"
```

---

## Phase 4: Alchemy Server-Side Migration (8-10 hours)

### Task 6: Create Alchemy Collections API Route

**Files:**
- Create: `src/app/api/alchemy/collections/route.js`

**Step 1: Create the route**

Create directory and file `src/app/api/alchemy/collections/route.js`:

```javascript
// Server-side Alchemy collections endpoint
// Keeps API keys secure on server
import { AlchemyMultichainClient } from '../../../alchemy-multichain-client.js';
import { validateAddressParam } from '../../../lib/validation.js';

export const dynamic = 'force-dynamic';

// Server-side API keys (not exposed to browser)
function getServerAlchemyKeys() {
  return {
    eth: process.env.ALCHEMY_ETH_API_KEY,
    polygon: process.env.ALCHEMY_POLYGON_API_KEY,
    arbitrum: process.env.ALCHEMY_ARB_API_KEY,
    optimism: process.env.ALCHEMY_OPT_API_KEY,
    base: process.env.ALCHEMY_BASE_API_KEY,
    zora: process.env.ALCHEMY_ZORA_API_KEY,
  };
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
    const keys = getServerAlchemyKeys();
    const client = new AlchemyMultichainClient(
      { apiKey: keys.eth },
      {
        MATIC_MAINNET: { apiKey: keys.polygon },
        ARB_MAINNET: { apiKey: keys.arbitrum },
        OPT_MAINNET: { apiKey: keys.optimism },
        BASE_MAINNET: { apiKey: keys.base },
        ZORA_MAINNET: { apiKey: keys.zora },
      }
    );

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
    console.error('[alchemy/collections] error', { message: error.message });
    return new Response(
      JSON.stringify({ error: 'Failed to fetch collections' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
```

**Step 2: Build to verify**

Run: `npm run build`
Expected: Build succeeds (route may warn about missing env vars, that's OK)

**Step 3: Commit**

```bash
git add src/app/api/alchemy/collections/route.js
git commit -m "feat(api): add server-side Alchemy collections endpoint"
```

---

### Task 7: Create Alchemy Owners Count API Route

**Files:**
- Create: `src/app/api/alchemy/owners-count/route.js`

**Step 1: Create the route**

Create `src/app/api/alchemy/owners-count/route.js`:

```javascript
// Server-side Alchemy owner count endpoint
import { AlchemyMultichainClient } from '../../../alchemy-multichain-client.js';

export const dynamic = 'force-dynamic';

function getServerAlchemyKeys() {
  return {
    eth: process.env.ALCHEMY_ETH_API_KEY,
    polygon: process.env.ALCHEMY_POLYGON_API_KEY,
    arbitrum: process.env.ALCHEMY_ARB_API_KEY,
    optimism: process.env.ALCHEMY_OPT_API_KEY,
    base: process.env.ALCHEMY_BASE_API_KEY,
    zora: process.env.ALCHEMY_ZORA_API_KEY,
  };
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

    // Validate contract address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(contract)) {
      return new Response(
        JSON.stringify({ error: 'Invalid contract address format' }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }

    const keys = getServerAlchemyKeys();
    const client = new AlchemyMultichainClient(
      { apiKey: keys.eth },
      {
        MATIC_MAINNET: { apiKey: keys.polygon },
        ARB_MAINNET: { apiKey: keys.arbitrum },
        OPT_MAINNET: { apiKey: keys.optimism },
        BASE_MAINNET: { apiKey: keys.base },
        ZORA_MAINNET: { apiKey: keys.zora },
      }
    );

    const ownerCount = await client.getOwnersCountForContract(network, contract, maxCount);

    return Response.json({ ownerCount });

  } catch (error) {
    console.error('[alchemy/owners-count] error', { message: error.message });
    return new Response(
      JSON.stringify({ error: 'Failed to fetch owner count' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
```

**Step 2: Build and commit**

```bash
npm run build
git add src/app/api/alchemy/owners-count/route.js
git commit -m "feat(api): add server-side Alchemy owners-count endpoint"
```

---

### Task 8: Create Alchemy Owners List API Route

**Files:**
- Create: `src/app/api/alchemy/owners/route.js`

**Step 1: Create the route**

Create `src/app/api/alchemy/owners/route.js`:

```javascript
// Server-side Alchemy owners list endpoint (paginated)
import { Alchemy, Network } from 'alchemy-sdk';

export const dynamic = 'force-dynamic';

const NETWORK_MAP = {
  'ETH_MAINNET': Network.ETH_MAINNET,
  'MATIC_MAINNET': Network.MATIC_MAINNET,
  'ARB_MAINNET': Network.ARB_MAINNET,
  'OPT_MAINNET': Network.OPT_MAINNET,
  'BASE_MAINNET': Network.BASE_MAINNET,
};

const API_KEY_MAP = {
  'ETH_MAINNET': () => process.env.ALCHEMY_ETH_API_KEY,
  'MATIC_MAINNET': () => process.env.ALCHEMY_POLYGON_API_KEY,
  'ARB_MAINNET': () => process.env.ALCHEMY_ARB_API_KEY,
  'OPT_MAINNET': () => process.env.ALCHEMY_OPT_API_KEY,
  'BASE_MAINNET': () => process.env.ALCHEMY_BASE_API_KEY,
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const network = searchParams.get('network');
    const contract = searchParams.get('contract');
    const pageKey = searchParams.get('pageKey') || undefined;

    if (!network || !contract) {
      return new Response(
        JSON.stringify({ error: 'Missing network or contract parameter' }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }

    if (!NETWORK_MAP[network]) {
      return new Response(
        JSON.stringify({ error: 'Unsupported network' }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }

    const apiKey = API_KEY_MAP[network]?.();
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key not configured for network' }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }

    const alchemy = new Alchemy({
      apiKey,
      network: NETWORK_MAP[network],
    });

    const result = await alchemy.nft.getOwnersForContract(contract, { pageKey });

    return Response.json({
      owners: result.owners || [],
      pageKey: result.pageKey || null,
    });

  } catch (error) {
    console.error('[alchemy/owners] error', { message: error.message });
    return new Response(
      JSON.stringify({ error: 'Failed to fetch owners' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
```

**Step 2: Build and commit**

```bash
npm run build
git add src/app/api/alchemy/owners/route.js
git commit -m "feat(api): add server-side Alchemy owners endpoint"
```

---

### Task 9: Create Client-Side Alchemy API Wrapper

**Files:**
- Create: `src/app/lib/alchemy-api.js`

**Step 1: Create the wrapper**

Create `src/app/lib/alchemy-api.js`:

```javascript
// Client-side wrapper for server-side Alchemy API routes
// Use this instead of AlchemyMultichainClient in browser code

/**
 * Fetch NFT collections for a wallet address
 * @param {string} address - Wallet address
 * @param {string} filter - Filter type ('relevant' or 'all')
 * @param {string[]|null} networks - Optional list of networks to query
 * @returns {Promise<Array>} - Collection objects
 */
export async function getCollectionsForOwner(address, filter = 'relevant', networks = null) {
  const params = new URLSearchParams({ address, filter });
  if (networks && networks.length > 0) {
    params.set('networks', networks.join(','));
  }

  const res = await fetch(`/api/alchemy/collections?${params}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Failed to fetch collections');
  }

  const data = await res.json();
  return data.collections || [];
}

/**
 * Get owner count for an NFT contract
 * @param {string} network - Network name (e.g., 'ETH_MAINNET')
 * @param {string} contract - Contract address
 * @param {number} maxCount - Maximum owners to count
 * @returns {Promise<number>} - Owner count
 */
export async function getOwnersCountForContract(network, contract, maxCount = 25000) {
  const params = new URLSearchParams({ network, contract, maxCount: String(maxCount) });

  const res = await fetch(`/api/alchemy/owners-count?${params}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Failed to fetch owner count');
  }

  const data = await res.json();
  return data.ownerCount || 0;
}

/**
 * Get owners for an NFT contract (paginated)
 * @param {string} network - Network name
 * @param {string} contract - Contract address
 * @param {string|null} pageKey - Pagination key
 * @returns {Promise<{owners: string[], pageKey: string|null}>}
 */
export async function getOwnersForContract(network, contract, pageKey = null) {
  const params = new URLSearchParams({ network, contract });
  if (pageKey) {
    params.set('pageKey', pageKey);
  }

  const res = await fetch(`/api/alchemy/owners?${params}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Failed to fetch owners');
  }

  return res.json();
}

/**
 * Get all owners for an NFT contract (handles pagination)
 * @param {string} network - Network name
 * @param {string} contract - Contract address
 * @param {number} maxOwners - Maximum owners to fetch
 * @returns {Promise<string[]>} - Array of owner addresses
 */
export async function getAllOwnersForContract(network, contract, maxOwners = 150000) {
  let allOwners = [];
  let pageKey = null;

  do {
    const result = await getOwnersForContract(network, contract, pageKey);
    allOwners = allOwners.concat(result.owners || []);
    pageKey = result.pageKey;

    if (allOwners.length >= maxOwners) {
      break;
    }
  } while (pageKey);

  return allOwners;
}
```

**Step 2: Build and commit**

```bash
npm run build
git add src/app/lib/alchemy-api.js
git commit -m "feat(lib): add client-side Alchemy API wrapper"
```

---

### Task 10: Update test-common-assets to Use New API

**Files:**
- Modify: `src/app/test-common-assets/page.js`

**Step 1: Update imports and NFT fetching**

At the top of the file, replace:
```javascript
import { AlchemyMultichainClient } from '../alchemy-multichain-client';
```

With:
```javascript
import * as AlchemyAPI from '../lib/alchemy-api.js';
```

**Step 2: Update fetchWalletAssets function**

In the `fetchWalletAssets` function, replace the NFT fetching block:
```javascript
// NFTs (if networks provided, only query those - much faster)
(async () => {
  try {
    const alchemy = new AlchemyMultichainClient();
    const collections = await alchemy.getCollectionsForOwner(address, 'relevant', () => {}, networks);
```

With:
```javascript
// NFTs (if networks provided, only query those - much faster)
(async () => {
  try {
    const collections = await AlchemyAPI.getCollectionsForOwner(address, 'relevant', networks);
```

**Step 3: Update fetchAssets function**

In the `fetchAssets` function, replace:
```javascript
const alchemy = new AlchemyMultichainClient();
const collections = await alchemy.getCollectionsForOwner(targetAddress, 'relevant');
```

With:
```javascript
const collections = await AlchemyAPI.getCollectionsForOwner(targetAddress, 'relevant');
```

**Step 4: Update fetchNFTOwnerCounts function**

Replace:
```javascript
const alchemy = new AlchemyMultichainClient();
// ...
const ownerCount = await alchemy.getOwnersCountForContract(nft.network, nft.address);
```

With:
```javascript
// ...
const ownerCount = await AlchemyAPI.getOwnersCountForContract(nft.network, nft.address);
```

Remove the `const alchemy = new AlchemyMultichainClient();` line.

**Step 5: Build and test**

```bash
npm run build
npm run dev
```

Test the page at http://localhost:3000/test-common-assets

**Step 6: Commit**

```bash
git add src/app/test-common-assets/page.js
git commit -m "refactor: use server-side Alchemy API in test-common-assets"
```

---

### Task 11: Update Main Page Components

**Files:**
- Modify: `src/app/components/NftTableList.js`
- Modify: `src/app/components/KindredSpiritsList.js`
- Modify: `src/app/page.js`

**Note:** This task requires careful review of each component's usage of AlchemyMultichainClient. The pattern is the same as Task 10:

1. Replace `import { AlchemyMultichainClient }` with `import * as AlchemyAPI`
2. Replace `new AlchemyMultichainClient()` instantiation with direct API calls
3. Replace method calls like `alchemy.getCollectionsForOwner()` with `AlchemyAPI.getCollectionsForOwner()`

**Step 1: Update each file following the pattern**

For each file, search for:
- `AlchemyMultichainClient` - replace import and instantiation
- `alchemy.getCollectionsForOwner` - replace with `AlchemyAPI.getCollectionsForOwner`
- `alchemy.getOwnersCountForContract` - replace with `AlchemyAPI.getOwnersCountForContract`
- `alchemy.nft.getOwnersForContract` - replace with `AlchemyAPI.getOwnersForContract`

**Step 2: Build and test all flows**

```bash
npm run build
npm run dev
```

Test:
1. Main page NFT loading
2. Owner count fetching
3. Kindred spirits analysis

**Step 3: Commit**

```bash
git add src/app/components/NftTableList.js \
        src/app/components/KindredSpiritsList.js \
        src/app/page.js
git commit -m "refactor: migrate main page components to server-side Alchemy API"
```

---

### Task 12: Update Server-Side Routes

**Files:**
- Modify: `src/app/api/analyze-combined-overlap/route.js`
- Modify: `src/app/api/analyze-combined-overlap/stream/route.js`

**Step 1: Update server routes to use explicit keys**

These routes already run server-side, but they import AlchemyMultichainClient which still reads from NEXT_PUBLIC_* by default. Update them to pass server-side keys explicitly:

```javascript
const client = new AlchemyMultichainClient(
  { apiKey: process.env.ALCHEMY_ETH_API_KEY },
  {
    [Network.MATIC_MAINNET]: { apiKey: process.env.ALCHEMY_POLYGON_API_KEY },
    [Network.ARB_MAINNET]: { apiKey: process.env.ALCHEMY_ARB_API_KEY },
    [Network.OPT_MAINNET]: { apiKey: process.env.ALCHEMY_OPT_API_KEY },
    [Network.BASE_MAINNET]: { apiKey: process.env.ALCHEMY_BASE_API_KEY },
  }
);
```

**Step 2: Build and commit**

```bash
npm run build
git add src/app/api/analyze-combined-overlap/route.js \
        src/app/api/analyze-combined-overlap/stream/route.js
git commit -m "refactor: use explicit server-side Alchemy keys in analysis routes"
```

---

### Task 13: Remove NEXT_PUBLIC Alchemy Keys

**Files:**
- Modify: `src/app/alchemy-multichain-client.js`
- Modify: `.env.local.example`
- Update: Vercel environment variables

**Step 1: Update AlchemyMultichainClient default behavior**

Modify constructor to NOT read from NEXT_PUBLIC_* by default. Instead, throw an error if no keys provided:

```javascript
constructor(settings, overrides) {
  if (!settings || !settings.apiKey) {
    // In browser without keys = error (should use API routes)
    if (typeof window !== 'undefined') {
      throw new Error('AlchemyMultichainClient requires API keys. Use /api/alchemy/* routes from browser.');
    }
    // On server, require explicit keys
    throw new Error('AlchemyMultichainClient requires settings.apiKey');
  }
  // ... rest of constructor
}
```

**Step 2: Update .env.local.example**

Remove or comment out NEXT_PUBLIC_* Alchemy keys:
```bash
# Alchemy API Keys (server-side only - do NOT use NEXT_PUBLIC_ prefix)
ALCHEMY_ETH_API_KEY=your_eth_key
ALCHEMY_POLYGON_API_KEY=your_polygon_key
ALCHEMY_ARB_API_KEY=your_arb_key
ALCHEMY_OPT_API_KEY=your_opt_key
ALCHEMY_BASE_API_KEY=your_base_key
ALCHEMY_ZORA_API_KEY=your_zora_key

# REMOVED - these were exposed to browser:
# NEXT_PUBLIC_ETH_MAIN_API_KEY=xxx
# NEXT_PUBLIC_MATIC_MAIN_API_KEY=xxx
```

**Step 3: Update Vercel environment variables**

In Vercel dashboard:
1. Add new server-side keys: `ALCHEMY_ETH_API_KEY`, etc.
2. After deployment verified working, remove `NEXT_PUBLIC_*` Alchemy keys

**Step 4: Build and verify**

```bash
npm run build
```

Check browser bundle doesn't contain API keys:
```bash
grep -r "NEXT_PUBLIC_ETH_MAIN_API_KEY" .next/static/
```
Expected: No matches

**Step 5: Commit**

```bash
git add src/app/alchemy-multichain-client.js .env.local.example
git commit -m "security: remove NEXT_PUBLIC Alchemy keys from browser bundle"
```

---

## Phase 5: Final Verification

### Task 14: Security Verification

**Step 1: Build production bundle**

```bash
npm run build
```

**Step 2: Check for exposed API keys**

```bash
# Search for NEXT_PUBLIC API keys in bundle
grep -r "NEXT_PUBLIC_.*API_KEY" .next/static/ || echo "✓ No NEXT_PUBLIC API keys found in bundle"

# Search for any API key patterns
grep -r "sk-\|pk_\|alchemy\|moralis" .next/static/chunks/ | head -20
```

**Step 3: Test rate limiting**

```bash
npm run dev &
sleep 3

# Test analysis rate limit (should hit 429 after 10 requests)
for i in {1..12}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/analyze-combined-overlap \
    -H "Content-Type: application/json" \
    -d '{"address":"0x1234"}')
  echo "Request $i: HTTP $STATUS"
done
```

**Step 4: Test CSRF protection (production mode)**

```bash
NODE_ENV=production npm run dev &
sleep 3

# Should reject request from foreign origin
curl -X POST http://localhost:3000/api/analyze-combined-overlap \
  -H "Content-Type: application/json" \
  -H "Origin: https://evil-site.com" \
  -d '{"address":"0x1234"}'
```
Expected: 403 Invalid origin

**Step 5: Final commit and push**

```bash
git add -A
git commit -m "chore: security hardening complete"
git push
```

---

## Success Criteria Checklist

- [ ] No `NEXT_PUBLIC_*` Alchemy keys in browser bundle
- [ ] No `NEXT_PUBLIC_*` Moralis fallback in server routes
- [ ] Error messages don't expose stack traces
- [ ] Rate limiting returns 429 after threshold
- [ ] CSRF protection returns 403 for foreign origins
- [ ] All existing functionality still works
- [ ] Build passes
- [ ] Lint passes

---

## Environment Variables Summary

**Remove (exposed to browser):**
```
NEXT_PUBLIC_ETH_MAIN_API_KEY
NEXT_PUBLIC_MATIC_MAIN_API_KEY
NEXT_PUBLIC_ARB_MAIN_API_KEY
NEXT_PUBLIC_OPT_MAIN_API_KEY
NEXT_PUBLIC_BASE_MAIN_API_KEY
NEXT_PUBLIC_ZORA_MAIN_API_KEY
```

**Add (server-side only):**
```
ALCHEMY_ETH_API_KEY
ALCHEMY_POLYGON_API_KEY
ALCHEMY_ARB_API_KEY
ALCHEMY_OPT_API_KEY
ALCHEMY_BASE_API_KEY
ALCHEMY_ZORA_API_KEY
```

**Keep unchanged:**
```
MORALIS_API_KEY (already server-side)
POAP_API_KEY (already server-side)
NEXT_PUBLIC_PROJECT_ID (WalletConnect - OK to expose)
NEXT_PUBLIC_NEYNAR_API_KEY (needs separate migration)
NEXT_PUBLIC_AIRSTACK_KEY (needs separate migration)
```
