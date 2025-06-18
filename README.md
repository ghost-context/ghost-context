![My Image](https://res.cloudinary.com/dyufyqpqy/image/upload/v1693183555/screencapture-ghostcontext-xyz-2023-08-25-08_28_40_fz0peq.png)
# 👻✨ Ghost Context Project Overview
<div>
<img src="https://res.cloudinary.com/dyufyqpqy/image/upload/v1693183555/TAnF3rkVyUxIfRvV184CtDSzr7fqn1pxVF9Av42WOQHAInldKdnHqJ2ENWkYoPTPJxDYgSLnwULn9MQkplnSukelqF1NZ6cB_UUqs-zuThy4xb5AXcGwDXM2bn8OwTkM4JBtf3_W_rleSRHYNa4PUH0_vxegc0.jpg" width="75" height="100"><br>
</div>

Ghost Context is a wallet-based discovery app. Our app helps users run analysis on NFTs held by any wallet address to summon a weighted list of kindred spirits based on the frequency of commonly held NFTs based on source-wallet collections.

[Visit our website](https://www.ghostcontext.xyz/)

![My Image](https://res.cloudinary.com/dyufyqpqy/image/upload/v1693183554/kindreds_p3oaje.png)

## 🦇 Signal 

The app analyzes ERC-721 and ERC-1155 NFTs across multiple blockchain networks using Alchemy's comprehensive NFT APIs. We've built robust multi-chain support including Ethereum, Polygon, Arbitrum, Optimism, Base, Avalanche, Gnosis, Linea, Celo, and many more Layer 2 solutions.

Our app also integrates POAP (Proof of Attendance Protocol) events to provide deeper insight into user engagement and community participation patterns.

We continue to optimize performance for handling large volumes of NFT data across these diverse blockchain ecosystems.

## 🌐 Supported Networks

**Fully Supported via Alchemy:**
- Ethereum, Polygon, Arbitrum, Optimism, Base
- Avalanche, Gnosis, Linea, Celo
- Polygon zkEVM, Starknet, zkSync, Scroll, Blast, Mantle, Metis
- Arbitrum Nova, Astar, ZetaChain

**Special Integrations:**
- **POAP Events**: Direct POAP API integration for attendance-based analysis
- **ENS Resolution**: Multi-chain ENS name resolution

## 🪬 Our Thesis
![My Image](https://res.cloudinary.com/dyufyqpqy/image/upload/v1693183555/thesis_2_wpzcqt.jpg)

Why is surfacing ghost context infinitely interesting?

- It's a cheat code unique to web3 for finding your connections on the red thread of fate.
- Ghosties—previously invisible kindred collectors, now made visible through surfaced ghost context—have a high likelihood of being up to interesting stuff or curating high-affinity stuff that satisfies your thumbprint of curiosity.
- Getting your Ghostie Row (top kindred spirits) on your radar is destined to unveil pathways of inspiration in the future.
- Surfacing ghost context produces inexorable resonance across web3.

If none of the above proves true…yet, the latent possibility of meeting the minds in your Ghostie Row and experiencing hyperconnection might manifest something meaningful, like the phenomena of generating scenius, birthing a hyperculture, or contributing to chaos magic.

Your Ghostie Row may be the key to leveling up your own neuroplasticity and output, as these kindred collectors are motivated to act as force multipliers on your most meaningful work.

## Roadmap

- ✅ Multi-chain NFT analysis (Ethereum, Polygon, Arbitrum, Optimism, Base, etc.)
- ✅ POAP integration for event-based connections
- ✅ Advanced spam filtering and collection validation
- 🔄 Organize NFTs by transfer time
- 🔄 Integrate Web3 social handles into results (Farcaster, Lens)
- 🔄 Integrate XMTP into results
- 🔄 Increase results from Top 20 to Top 150
- 🔄 Facilitate wallet to wallet connections via double opt-in logic
- 🔄 Deploy ability to run analysis with "OR" Boolean Operators e.g. run ghost context analysis on NFT X and Y OR NFT Z
- 🔄 Notifications

## Current Tech Stack

- **Frontend**: Next.js, React, Tailwind CSS
- **Blockchain**: Ethers.js, Wagmi, WalletConnect (Web3Modal)
- **NFT Data**: Alchemy SDK (Multi-chain NFT APIs)
- **POAP Integration**: Direct POAP API
- **ENS**: ENS resolution across chains
- **Social**: Airstack integration for Web3 social profiles

## Getting Started

This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

### Prerequisites

- Node.js and npm installed on your machine
- An Ethereum wallet like MetaMask for interacting with the dApp
- Alchemy API Keys for supported networks

### Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```bash
# Core Alchemy API Keys (required)
NEXT_PUBLIC_ETH_MAIN_API_KEY=your_ethereum_alchemy_key
NEXT_PUBLIC_MATIC_MAIN_API_KEY=your_polygon_alchemy_key
NEXT_PUBLIC_ARB_MAIN_API_KEY=your_arbitrum_alchemy_key
NEXT_PUBLIC_OPT_MAIN_API_KEY=your_optimism_alchemy_key
NEXT_PUBLIC_BASE_MAIN_API_KEY=your_base_alchemy_key

# Additional Networks (optional)
NEXT_PUBLIC_AVAX_MAIN_API_KEY=your_avalanche_alchemy_key
NEXT_PUBLIC_GNOSIS_MAIN_API_KEY=your_gnosis_alchemy_key
NEXT_PUBLIC_LINEA_MAIN_API_KEY=your_linea_alchemy_key
NEXT_PUBLIC_CELO_MAIN_API_KEY=your_celo_alchemy_key

# Other APIs
NEXT_PUBLIC_AIRSTACK_KEY=your_airstack_key
NEXT_PUBLIC_PROJECT_ID=your_walletconnect_project_id
```

### Installation & Development

```bash
# Install dependencies
npm install

# Run the development server
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.

## Migration Notes

This project was recently migrated from SimpleHash to Alchemy's NFT APIs for improved reliability and broader network support. For migration details, see `SIMPLEHASH_MIGRATION_GUIDE.md`.

## Contributions
![My Image](https://res.cloudinary.com/dyufyqpqy/image/upload/v1693183548/quiji_h6ktyc.gif)

```
              _ .-'  / .._
           .-:'/ - - \:::::-.
         .::: '  e e  ' '-::::.
        ::::'(    ^    )_.::::::
       ::::.' '.  o   '.::::'.'/_
   .  :::.'       -  .::::'_   _.:
 .-''---' .'|      .::::'   '''::::
'. ..-:::'  |    .::::'        ::::
 '.' ::::    \ .::::'          ::::
      ::::   .::::'           ::::
       ::::.::::'._          ::::
        ::::::' /  '-      .::::
         '::::-/__    __.-::::'
           '-::::::::::::::-'
jrei           '''::::'''
```


