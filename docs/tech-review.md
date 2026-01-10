# Technical Review: ghost-context
*Last updated: 2026-01-09*

## Summary

Ghost Context is a functional Web3 app with good core architecture but significant technical debt in component organization and security hardening. The app successfully integrates 5+ external APIs (Alchemy, Moralis, POAP, Neynar, Airstack) but lacks tests and TypeScript.

**Key Findings:**
1. Two components exceed 400 lines and need splitting
2. ~~Concurrency utility duplicated in 3 files~~ ✅ Fixed - extracted to `src/app/lib/concurrency.js`
3. API keys exposed in browser bundle (Alchemy, Neynar, Airstack)
4. ~~No input validation for Ethereum address format~~ ✅ Fixed - added `src/app/lib/validation.js`
5. No test framework configured

## Code Metrics

| Metric | Value |
|--------|-------|
| Files | 37 |
| Total Lines | 5,969 |
| Code Lines | 4,929 (82.6%) |
| Comments | 341 (5.7%) |
| Functions | 76 (avg 34 lines) |
| Large Files (>500 lines) | 2 |
| Long Functions (>50 lines) | 15+ |

## Strengths

1. **Well-structured API routes** - Clear separation of concerns between NFT, POAP, and ERC-20 analysis
2. **Proper concurrency control** - 4-parallel limit prevents API throttling
3. **Memory safety** - 150k holder limit prevents unbounded memory usage
4. **Good image handling** - `normalizeImageUrl()` handles ipfs://, ar://, and other URI schemes
5. **Context API used correctly** - Memoization prevents unnecessary re-renders (`page.js:14-17`)
6. **Clean PoapClient pattern** - Constructor + method pattern without prototype pollution

## Issues & Recommendations

### High Priority

| Issue | Impact | Location | Status |
|-------|--------|----------|--------|
| NEXT_PUBLIC API keys in browser | Keys extractable from bundle | `alchemy-multichain-client.js:38-47` | ⏳ Pending |
| ~~No address format validation~~ | ~~Malformed input to external APIs~~ | ~~All `/api/*` routes~~ | ✅ Fixed |
| ~~processWithConcurrency duplicated~~ | ~~Maintenance burden~~ | ~~3 files~~ | ✅ Fixed |
| KindredSpiritsList too large | Hard to maintain/test | 414 lines | ⏳ Pending |
| NftTableList too large | Hard to maintain/test | 542 lines | ⏳ Pending |

### Medium Priority

| Issue | Impact | Location | Status |
|-------|--------|----------|--------|
| No rate limiting on routes | DoS vulnerability | All `/api/*` routes | ⏳ Pending |
| Fallback to public keys | Silent security degradation | `get-filtered-tokens/route.js:23` | ⏳ Pending |
| ~~Debug param exposes data~~ | ~~Information disclosure~~ | ~~3 API routes~~ | ✅ Fixed |
| No CSRF protection | Cross-site request forgery | POST endpoints | ⏳ Pending |
| Fetch error handling repeated | Code duplication | 6+ files | ⏳ Pending |
| Two modal libraries | Inconsistent UX | react-modal + @headlessui | ⏳ Pending |

### Low Priority

| Issue | Impact | Location | Status |
|-------|--------|----------|--------|
| Verbose error messages | Minor info disclosure | `analyze-combined-overlap.js:299` | ⏳ Pending |
| ~~Event ID not numeric-checked~~ | ~~Edge case errors~~ | ~~`poap/event/route.js`~~ | ✅ Fixed |
| ~~Address formatting duplicated~~ | ~~Minor maintenance~~ | ~~`Address.js`, `SocialCard.js`~~ | ✅ Fixed |
| test-common-assets page | 1953 lines | Debug page | ⏳ Low priority |

## Recommended File Structure

```
src/app/
├── lib/                          # NEW: Shared utilities
│   ├── concurrency.js            # processWithConcurrency()
│   ├── fetch-utils.js            # fetchJson(), fetchWithRetry()
│   ├── address-utils.js          # formatAddress(), isValidAddress()
│   └── image-utils.js            # normalizeImageUrl()
├── hooks/                        # NEW: Custom React hooks
│   ├── useCollectionFetching.js  # Extract from NftTableList
│   ├── useOwnerCounts.js         # Extract from NftTableList
│   └── useKindredSpirits.js      # Extract from KindredSpiritsList
├── components/
│   ├── context/
│   │   ├── EnsContext.js
│   │   ├── CollectionContext.js  # Split from KindredButtonContext
│   │   └── AnalysisContext.js    # Split from KindredButtonContext
│   ├── KindredSpiritsList/       # Split into folder
│   │   ├── index.js
│   │   ├── Table.js
│   │   └── Modal.js
│   └── NftTableList/             # Split into folder
│       ├── index.js
│       ├── Table.js
│       └── Filters.js
└── api/                          # Mostly OK
```

## Security Checklist

- [ ] Move Alchemy SDK calls to server-side API routes
- [x] Add Ethereum address validation regex to all routes
- [x] Remove or gate `?debug=1` parameter in production
- [ ] Add rate limiting middleware
- [ ] Validate origin header on POST endpoints
- [ ] Audit error messages for information leakage

## Time Estimates

### Quick Wins (~3 hours total)
| Task | Time | Status |
|------|------|--------|
| Add address validation regex to 6 API routes | 0.5h | ✅ Done |
| Disable `?debug=1` in production | 0.25h | ✅ Done |
| Extract `processWithConcurrency()` to shared lib | 1h | ✅ Done |
| Extract `fetchJson()` utility | 1h | ⏳ Pending |
| Extract address formatting utility | 0.25h | ✅ Done |

### Medium Effort (~8-12 hours total)
| Task | Time | Status |
|------|------|--------|
| Split KindredButtonContext into 2 contexts | 2h | |
| Add rate limiting middleware | 2h | |
| Validate origin header on POST endpoints | 1h | |
| Standardize on one modal library | 2-3h | |
| Remove public key fallbacks in API routes | 1h | |

### Large Refactors (~20-30 hours total)
| Task | Time | Status |
|------|------|--------|
| Split NftTableList.js (542 lines) | 6-8h | |
| Split KindredSpiritsList.js (414 lines) | 4-6h | |
| Move Alchemy client-side calls to API routes | 8-12h | |
| Add TypeScript to critical paths | 4-6h | |

### Major Investment (~20+ hours)
| Task | Time | Status |
|------|------|--------|
| Add test framework + initial coverage | 8-12h | |
| Comprehensive E2E tests | 12-16h | |

### Summary
| Category | Hours | Priority |
|----------|-------|----------|
| Quick wins | 3h | Do now |
| Security hardening | 6h | High |
| Component refactoring | 12-16h | Medium |
| Full test coverage | 20-28h | Low |

**Minimum viable improvements** (security + quick wins): ~8-10 hours
**Production-ready state**: 25-35 hours

## API Client Quality

| Client | Lines | Pattern | Quality | Notes |
|--------|-------|---------|---------|-------|
| AlchemyMultichainClient | 457 | Prototype extension | Medium | Good caching, but prototype pollution |
| NeynarClient | 125 | Class methods | Medium | Code duplication between methods |
| PoapClient | 51 | Clean class | Good | Best pattern in codebase |
| AirStackClient | 42 | Class methods | Medium | No error handling |

## Dependencies Status

As of 2026-01-09:
- **Vulnerabilities**: 39 remaining (37 low, 2 moderate)
- **Unfixable**: `elliptic` in alchemy-sdk, moralis, @web3modal (waiting on upstream)
- **Recently fixed**: Removed unused `@alch/alchemy-web3`, `ethers`; updated Next.js to 14.2.35
