# Ghost Context: Technical Improvement Proposal

*Created: 2026-01-09*

## Executive Summary

Ghost Context is a functional Web3 wallet discovery app that successfully integrates 5+ external APIs. Following a technical review, we've identified improvements across performance, security, maintainability, and code quality. These changes will make the app faster, more secure, and easier to maintain.

**Estimated effort:** ~10 hours, 4 chunks

---

## Proposed Improvements

### 1. Performance Optimizations

**What:** Implement Top-K algorithm for holder analysis, add DataLoader pattern for batching, introduce caching layer, and add retry logic for flaky API calls.

**Why it matters:**
- **Faster analysis** — Top-K algorithm reduces memory usage and speeds up kindred spirit calculations by stopping early once top results are found
- **Fewer API calls** — DataLoader batches multiple requests, reducing rate limit errors
- **Better reliability** — Retry logic handles transient failures from Alchemy, POAP, and Moralis APIs
- **Reduced latency** — Caching prevents redundant fetches for the same data within a session

### 2. Security Hardening

**What:** Move Alchemy SDK calls to server-side API routes, add rate limiting middleware, and implement CSRF protection on POST endpoints.

**Why it matters:**
- **Protected API keys** — Currently Alchemy, Neynar, and Airstack keys are exposed in the browser bundle; moving to server-side prevents key extraction
- **DoS protection** — Rate limiting prevents abuse of API routes
- **Request validation** — CSRF protection ensures requests originate from the app

### 3. Component Refactoring

**What:** Split NftTableList (542 lines) and KindredSpiritsList (414 lines) into smaller, focused components. Extract custom hooks for collection fetching, owner counts, and analysis logic.

**Why it matters:**
- **Easier maintenance** — Smaller components are easier to understand and modify
- **Better reusability** — Extracted hooks can be used across components
- **Improved testing** — Isolated logic is simpler to unit test
- **Faster development** — Clear component boundaries reduce cognitive load

### 4. TypeScript + Unit Tests

**What:** Migrate codebase to TypeScript, set up Jest, and add tests for utilities and hooks.

**Why it matters:**
- **Catch bugs early** — Type checking prevents runtime errors from type mismatches
- **Better IDE support** — Autocomplete, refactoring tools, and inline documentation
- **Confidence in changes** — Unit tests verify utilities work correctly after modifications
- **Documentation** — Types serve as living documentation for function signatures

---

## What We're Deferring

**E2E Tests** (??) — Playwright setup and critical flow tests. While valuable for catching integration issues, the ROI is lower for an app at this stage. Can be added later when the codebase is more stable.

---

## Implementation Order

1. **Performance** — Immediate UX improvement, users notice faster analysis
2. **Security** — Protects API keys before broader deployment
3. **Refactoring** — Prepares codebase for TypeScript migration
4. **TypeScript + Tests** — Locks in quality improvements

---

## Success Criteria

- [ ] Analysis completes 2-3x faster for large collections
- [ ] No API keys exposed in browser bundle
- [ ] No component exceeds 200 lines
- [ ] TypeScript strict mode enabled
- [ ] Core utilities have 80%+ test coverage
- [ ] Build passes with no warnings

---

## Detailed Plans

See `docs/plans/` for implementation details:
- [Performance Optimizations](plans/2026-01-09-performance-optimizations-design.md)
- [Security Hardening](plans/2026-01-09-security-hardening-design.md)
- [Component Refactoring](plans/2026-01-09-component-refactoring-design.md)
- [TypeScript + Unit Tests](plans/2026-01-09-typescript-unit-tests-design.md)
