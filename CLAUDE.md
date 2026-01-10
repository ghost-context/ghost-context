# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ghost Context is a Web3 wallet discovery app that analyzes NFTs, POAPs, and ERC-20 tokens held by a wallet to find "kindred spirits" - other wallets with similar asset holdings. Users connect a wallet or enter an ENS address, select collections to analyze, and the app identifies wallets with the most overlap.

## Commands

```bash
npm run dev          # Start development server on port 3000
npm run dev:open     # Start dev server and open Chrome with DevTools
npm run build        # Build for production
npm run lint         # Run ESLint
```

**Node.js Requirement**: v22.x

## Code Metrics

- Files: 37 | Lines: 5,969 (4,929 code, 341 comments)
- Functions: 76 (avg 34 lines)
- Complexity flags: 2 large files, 15+ long functions

## Architecture

### Tech Stack
- Next.js 14 (App Router)
- React 18 with Tailwind CSS
- WalletConnect (Web3Modal) + Wagmi for wallet connection
- Alchemy SDK for NFT data across multiple EVM chains
- Moralis API for ERC-20 token holder data
- POAP API for event-based collectibles
- Neynar for Farcaster social data
- Airstack for social graph queries

### Supported Networks
- **Alchemy**: Ethereum, Polygon, Arbitrum, Optimism, Base
- **POAP**: Treated as pseudo-network for event collections
- **Moralis ERC-20**: Base network for token holder data

### Core Data Flow

1. **Wallet Connection** (`src/app/providers.js`): Web3Modal setup with support for Ethereum, Polygon, Arbitrum, Optimism, and Base chains.

2. **Collection Fetching** (`src/app/alchemy-multichain-client.js`): `AlchemyMultichainClient` wraps Alchemy SDK to query NFTs across multiple networks. Extended via prototype methods:
   - `getCollectionsForOwner(wallet, filter, progressCallback)` - Fetches all NFT collections + POAPs for a wallet
   - `getOwnersCountForContract(network, contract, maxCount)` - Counts owners with pagination
   - `getLatestInboundTransferTimestamp(network, contract, wallet)` - Gets transfer history

   The client handles image URL normalization for ipfs://, ar://, and other URI schemes.

3. **Kindred Spirit Analysis**: Two pathways:
   - Client-side via `KindredSpiritsList.js`: Iterates selected collections, fetches all holders per collection, counts overlap
   - Server-side via `/api/analyze-combined-overlap/route.js`: Unified endpoint that analyzes NFTs (Alchemy), POAPs, and ERC-20s (Moralis) together

4. **State Management** (`src/app/components/context/`):
   - `EnsContext`: Stores resolved ENS address
   - `KindredButtonContext`: Manages selected collections, triggers analysis, stores results

### API Routes (`src/app/api/`)

- `/api/analyze-combined-overlap` - Main unified analysis endpoint combining NFTs, POAPs, and ERC-20s
- `/api/analyze-erc20-overlap` - ERC-20 specific analysis using Moralis
- `/api/get-filtered-tokens` - Fetch tokens with filtering options
- `/api/poap/*` - POAP event data and holder fetching
- `/api/socials/farcaster` - Farcaster profile lookup

### Key Constraints

- **150k holder limit**: Analysis caps at 150,000 holders per collection to prevent memory issues
- **Top 100 results**: Kindred spirits list is capped at 100 wallets
- **Minimum overlap threshold**: When analyzing 2+ assets, requires at least 2 shared assets to qualify as kindred

### Environment Variables Required

```
NEXT_PUBLIC_PROJECT_ID          # WalletConnect project ID
NEXT_PUBLIC_ETH_MAIN_API_KEY    # Alchemy - Ethereum
NEXT_PUBLIC_MATIC_MAIN_API_KEY  # Alchemy - Polygon
NEXT_PUBLIC_ARB_MAIN_API_KEY    # Alchemy - Arbitrum
NEXT_PUBLIC_OPT_MAIN_API_KEY    # Alchemy - Optimism
NEXT_PUBLIC_BASE_MAIN_API_KEY   # Alchemy - Base
MORALIS_API_KEY                 # Moralis API for ERC-20 data (server-side)
MORALIS_PLAN                    # 'free' or 'starter' (affects rate limits)
POAP_API_KEY                    # POAP API access (server-side)
NEXT_PUBLIC_NEYNAR_API_KEY      # Neynar API for Farcaster data
NEXT_PUBLIC_AIRSTACK_KEY        # Airstack API for social graph queries
```

### Moralis Configuration

`src/app/moralis-config.js` manages API rate limiting based on plan tier. Set `MORALIS_PLAN=starter` for higher throughput.

### Asset Types

The app analyzes three distinct asset types, each with its own data source:
- **NFTs** (ERC-721/ERC-1155): Fetched via Alchemy SDK, supports multi-chain
- **POAPs**: Event-based collectibles via POAP API, paginated at 500 per page
- **ERC-20 Tokens**: Token holder data via Moralis API (Base network)

## Known Issues & Technical Debt

### Complexity Hotspots
- `src/app/components/NftTableList.js` (542 lines) - needs splitting
- `src/app/components/KindredSpiritsList.js` (414 lines) - needs splitting
- `src/app/test-common-assets/page.js` (1953 lines) - debug page, low priority

### Code Duplication
- `processWithConcurrency()` duplicated in 3 files - extract to shared utility
- Fetch error handling repeated 6+ times - needs shared utility
- Address formatting logic duplicated in Address.js and SocialCard.js

### Security Notes
- NEXT_PUBLIC keys are exposed in browser bundle (Alchemy, Neynar, Airstack)
- API routes validate address presence but not format (no regex for 0x address)
- No rate limiting on API routes - relies on upstream API limits
- Debug param (`?debug=1`) exposes raw API responses in some routes

### Missing
- No tests (no test framework configured)
- No TypeScript (all vanilla JS)
- No error boundary component

## Testing

- `/test-common-assets` - Debug page for testing the common assets finder feature
- Run `npm run build` to verify compilation
- Run `npm run lint` to check for ESLint issues

## Deployment

- **Vercel**: Deploys from `sloan-updates` branch
- **Docker**: `Dockerfile` configured for standalone Next.js output
- **Cloud Run**: `bitbucket-pipelines.yml` for GCP deployment
