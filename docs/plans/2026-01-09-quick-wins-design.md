# Quick Wins Design
*Created: 2026-01-09*

## Overview

Remaining small fixes that don't require deep architectural changes. These can be completed in a single session.

**Estimated time:** 2-3 hours

## Tasks

### 1. Extract `fetchJson()` Utility (~1h)

**Problem:** Fetch error handling is repeated across 6+ API routes with slight variations.

**Solution:** Create `src/app/lib/fetch-utils.js` with standardized fetch wrapper.

```javascript
// src/app/lib/fetch-utils.js

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

      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[${name}] failure`, { status: res.status, identifier, body: bodyText });
      }

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
    return {
      ok: false,
      error: new Response(
        JSON.stringify({ error: 'Fetch error', message: e?.message }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      )
    };
  }
}
```

**Files to update:**
- `src/app/api/poap/route.js`
- `src/app/api/poap/event/route.js`
- `src/app/api/poap/event/details/route.js`
- `src/app/api/socials/farcaster/route.js`
- `src/app/api/get-filtered-tokens/route.js`
- `src/app/api/get-tokens-fast/route.js`

**Pattern:**
```javascript
// Before
const res = await fetch(url, { headers });
if (!res.ok) {
  let bodyText = '';
  try { bodyText = await res.text(); } catch { bodyText = ''; }
  // ... 10 lines of error handling
}
const data = await res.json();

// After
const result = await fetchJson(url, { headers }, { name: 'POAP', identifier: address });
if (!result.ok) return result.error;
const data = result.data;
```

---

### 2. Remove Public Key Fallbacks (~1h)

**Problem:** Some API routes fall back to `NEXT_PUBLIC_*` keys when server-side keys are missing. This is a security anti-pattern - server routes should fail loudly, not silently use exposed keys.

**Files to check:**
- `src/app/api/get-filtered-tokens/route.js:22-23`
- `src/app/api/get-tokens-fast/route.js`
- Any route with pattern `process.env.X || process.env.NEXT_PUBLIC_X`

**Solution:**
```javascript
// Before
const apiKey = process.env.ALCHEMY_API_KEY || process.env.NEXT_PUBLIC_ETH_MAIN_API_KEY || '';

// After
const apiKey = process.env.ALCHEMY_API_KEY;
if (!apiKey) {
  return new Response(
    JSON.stringify({ error: 'Missing ALCHEMY_API_KEY in environment' }),
    { status: 500, headers: { 'content-type': 'application/json' } }
  );
}
```

---

### 3. Audit Error Messages (~0.5h)

**Problem:** Some error responses include raw error details that could leak implementation info.

**Files to audit:**
- `src/app/api/analyze-combined-overlap/route.js:299` - check what's exposed
- All routes returning `e?.message` directly

**Solution:** Return generic messages to client, log details server-side:
```javascript
// Before
return new Response(
  JSON.stringify({ error: 'Unhandled error', message: e?.message }),
  { status: 500 }
);

// After
if (process.env.NODE_ENV !== 'production') {
  console.error('[API] Unhandled error', e);
}
return new Response(
  JSON.stringify({ error: 'Internal server error' }),
  { status: 500, headers: { 'content-type': 'application/json' } }
);
```

---

## Checklist

- [ ] Create `src/app/lib/fetch-utils.js`
- [ ] Update 6 API routes to use `fetchJson()`
- [ ] Remove `NEXT_PUBLIC_*` fallbacks from server routes
- [ ] Audit and genericize error messages
- [ ] Run build to verify
- [ ] Test locally with missing env vars

## Success Criteria

- No `NEXT_PUBLIC_*` fallbacks in `/api/*` routes
- Consistent error handling pattern across all routes
- Error messages don't leak stack traces or internal details
- Build passes
