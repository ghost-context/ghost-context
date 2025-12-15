# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ghost Context is a Web3 wallet discovery app that analyzes NFTs, POAPs, and ERC-20 tokens held by a wallet to find "kindred spirits" - other wallets with similar asset holdings. Users connect a wallet or enter an ENS address, select collections to analyze, and the app identifies wallets with the most overlap.

## Commands

```bash
npm run dev          # Start development server on port 3000
npm run build        # Build for production
npm run lint         # Run ESLint
```

## Architecture

### Tech Stack
- Next.js 14 (App Router)
- React 18 with Tailwind CSS
- WalletConnect (Web3Modal) + Wagmi for wallet connection
- Alchemy SDK for NFT data across multiple EVM chains
- Moralis API for ERC-20 token holder data
- POAP API for event-based collectibles

### Core Data Flow

1. **Wallet Connection** (`src/app/providers.js`): Web3Modal setup with support for Ethereum, Polygon, Arbitrum, Optimism, and Base chains.

2. **Collection Fetching** (`src/app/alchemy-multichain-client.js`): `AlchemyMultichainClient` wraps Alchemy SDK to query NFTs across multiple networks. Key method `getCollectionsForOwner()` fetches all NFT collections a wallet owns.

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
MORALIS_API_KEY                 # Moralis API for ERC-20 data
MORALIS_PLAN                    # 'free' or 'starter' (affects rate limits)
POAP_API_KEY                    # POAP API access
```

### Moralis Configuration

`src/app/moralis-config.js` manages API rate limiting based on plan tier. Set `MORALIS_PLAN=starter` for higher throughput.
