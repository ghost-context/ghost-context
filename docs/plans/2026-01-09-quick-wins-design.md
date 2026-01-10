# Quick Wins Design
*Created: 2026-01-09*
*Completed: 2026-01-09*

## Overview

Small fixes that don't require deep architectural changes. Completed in a single session.

**Estimated time:** 2-3 hours
**Actual time:** ~2 hours

## Status: ✅ COMPLETED

All tasks in this plan have been implemented.

---

## Task 1: Extract `fetchJson()` Utility ✅

**Problem:** Fetch error handling was repeated across 6+ API routes with slight variations.

**Solution:** Created `src/app/lib/fetch-utils.js` with standardized fetch wrapper.

```javascript
// src/app/lib/fetch-utils.js
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
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[${name}] error`, e);
    }
    return {
      ok: false,
      error: new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      )
    };
  }
}
```

**Files updated to use `fetchJson()`:**
- ✅ `src/app/api/poap/route.js`
- ✅ `src/app/api/poap/event/details/route.js`
- ✅ `src/app/api/socials/farcaster/route.js`

**Files with complex multi-fetch logic (kept manual handling):**
- `src/app/api/poap/event/route.js` - has pagination with fallback endpoints
- `src/app/api/get-filtered-tokens/route.js` - loops over tokens
- `src/app/api/get-tokens-fast/route.js` - loops over chains

---

## Task 2: Remove Public Key Fallbacks ✅

**Problem:** Some API routes fell back to `NEXT_PUBLIC_*` keys when server-side keys were missing.

**Solution:** Removed all `|| process.env.NEXT_PUBLIC_*` fallbacks. Server routes now fail loudly if keys are missing.

**Files updated:**
- ✅ `src/app/api/poap/route.js` - removed `NEXT_PUBLIC_POAP_API_KEY` fallback
- ✅ `src/app/api/poap/event/route.js` - removed `NEXT_PUBLIC_POAP_API_KEY` fallback
- ✅ `src/app/api/poap/event/details/route.js` - removed `NEXT_PUBLIC_POAP_API_KEY` fallback
- ✅ `src/app/api/socials/farcaster/route.js` - removed `NEXT_PUBLIC_NEYNAR_API_KEY` fallback
- ✅ `src/app/api/get-filtered-tokens/route.js` - removed `NEXT_PUBLIC_MORALIS_API_KEY` fallback
- ✅ `src/app/api/get-tokens-fast/route.js` - removed `NEXT_PUBLIC_MORALIS_API_KEY` fallback

---

## Task 3: Audit Error Messages ✅

**Problem:** Some error responses included raw error details (`e?.message`) that could leak implementation info.

**Solution:** All catch blocks now:
1. Log full error in non-production only
2. Return generic "Internal server error" message

**Pattern applied:**
```javascript
// Before
} catch (e) {
  return new Response(
    JSON.stringify({ error: 'Unhandled error', message: e?.message }),
    { status: 500 }
  );
}

// After
} catch (e) {
  if (process.env.NODE_ENV !== 'production') {
    console.error('[API Name] error', e);
  }
  return new Response(
    JSON.stringify({ error: 'Internal server error' }),
    { status: 500, headers: { 'content-type': 'application/json' } }
  );
}
```

**Files updated:**
- ✅ `src/app/api/poap/route.js`
- ✅ `src/app/api/poap/event/route.js`
- ✅ `src/app/api/poap/event/details/route.js`
- ✅ `src/app/api/socials/farcaster/route.js`
- ✅ `src/app/api/get-filtered-tokens/route.js`
- ✅ `src/app/api/get-tokens-fast/route.js`

---

## Checklist

- [x] Create `src/app/lib/fetch-utils.js`
- [x] Update API routes to use `fetchJson()` where appropriate
- [x] Remove `NEXT_PUBLIC_*` fallbacks from server routes
- [x] Audit and genericize error messages
- [x] Run build to verify
- [x] Commit and push

## Files Created/Modified

**New files:**
- `src/app/lib/fetch-utils.js`

**Modified files:**
- `src/app/api/poap/route.js`
- `src/app/api/poap/event/route.js`
- `src/app/api/poap/event/details/route.js`
- `src/app/api/socials/farcaster/route.js`
- `src/app/api/get-filtered-tokens/route.js`
- `src/app/api/get-tokens-fast/route.js`

## Success Criteria Met

- ✅ No `NEXT_PUBLIC_*` fallbacks in `/api/*` routes
- ✅ Consistent error handling pattern across routes
- ✅ Error messages don't leak stack traces or internal details
- ✅ Build passes
