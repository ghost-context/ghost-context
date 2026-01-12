/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker deployments
  output: 'standalone',
  // Rewrite /health to /api/health for Cloud Run health checks
  async rewrites() {
    return [
      {
        source: '/health',
        destination: '/api/health',
      },
    ];
  },
  webpack: (config, { isServer }) => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    
    // Add fallbacks for browser-only modules
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
    };
    
    // Ignore react-native modules (MetaMask SDK tries to import these)
    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-native-async-storage/async-storage': false,
      'react-native': false,
      'idb-keyval': isServer ? false : 'idb-keyval',
    };
    
    return config;
  },
  transpilePackages: [
    '@web3modal/wagmi',
    '@web3modal/siwe',
    '@web3modal/core',
    '@web3modal/ui',
    '@walletconnect/ethereum-provider',
    '@walletconnect/sign-client',
    '@walletconnect/modal',
    '@walletconnect/jsonrpc-types',
  ],
}

module.exports = nextConfig
