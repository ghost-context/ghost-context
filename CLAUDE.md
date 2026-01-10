# CLAUDE.md

## Overview

Ghost Context: Web3 app that finds "kindred spirits" - wallets with similar NFT, POAP, and ERC-20 holdings.

## Commands

```bash
npm run dev       # Dev server on port 3000
npm run build     # Production build
npm run lint      # ESLint
```

Requires Node.js v22.x

## Architecture

**Stack:** Next.js 14 (App Router), React 18, Tailwind, WalletConnect/Wagmi

**APIs:**
- Alchemy SDK — NFTs across Ethereum, Polygon, Arbitrum, Optimism, Base
- Moralis — ERC-20 token holders (Base network)
- POAP — Event-based collectibles
- Neynar/Airstack — Farcaster social data

**Key Files:**
- `src/app/alchemy-multichain-client.js` — Multi-chain NFT fetching
- `src/app/api/analyze-combined-overlap/route.js` — Main analysis endpoint
- `src/app/components/context/` — EnsContext, KindredButtonContext

**Constraints:**
- 150k holder limit per collection
- Top 100 kindred spirits returned
- 2+ shared assets required for multi-asset analysis

## Shared Utilities (`src/app/lib/`)

| File | Purpose |
|------|---------|
| `concurrency.js` | Parallel processing with limit |
| `validation.js` | Address/ENS/eventId validation |
| `address-utils.js` | `shortenAddress()` formatting |
| `fetch-utils.js` | Standardized fetch with error handling |

## Environment Variables

```
NEXT_PUBLIC_PROJECT_ID          # WalletConnect
NEXT_PUBLIC_ETH_MAIN_API_KEY    # Alchemy keys (ETH, MATIC, ARB, OPT, BASE)
MORALIS_API_KEY                 # Server-side
POAP_API_KEY                    # Server-side
NEXT_PUBLIC_NEYNAR_API_KEY      # Farcaster
NEXT_PUBLIC_AIRSTACK_KEY        # Social graph
```

## Docs

- [Technical Review](docs/tech-review.md) — Issues, metrics, improvement plans
- [Proposal](docs/proposal.md) — Summary of planned improvements
