'use client';

import { useEffect, useState } from 'react';
import { createWeb3Modal } from '@web3modal/wagmi/react';
import { defaultWagmiConfig } from '@web3modal/wagmi/react/config';
import { WagmiProvider } from 'wagmi';
import { arbitrum, mainnet, polygon, optimism, base } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Setup queryClient
const queryClient = new QueryClient();

// Get projectId from environment
const projectId = process.env.NEXT_PUBLIC_PROJECT_ID;

// Define chains
const chains = [mainnet, arbitrum, polygon, optimism, base];

// Create wagmiConfig
const metadata = {
  name: 'Ghost Context',
  description: 'From Collections to Connections',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://ghost-context.vercel.app',
  icons: ['/ghost-emoji.svg']
};

const wagmiConfig = defaultWagmiConfig({
  chains,
  projectId,
  metadata,
});

// Track if modal has been created
let modalCreated = false;

export function Web3Provider({ children }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Only create modal once on client side
    if (!modalCreated && typeof window !== 'undefined') {
      try {
        createWeb3Modal({
          wagmiConfig,
          projectId,
          chains,
          themeMode: 'dark',
          themeVariables: {
            '--w3m-accent': '#8b5cf6',
          }
        });
        modalCreated = true;
      } catch (error) {
        // Modal might already be initialized, ignore error
        console.warn('Web3Modal initialization:', error.message);
      }
    }
  }, []);

  // Prevent SSR hydration mismatch
  if (!mounted) {
    return null;
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}

