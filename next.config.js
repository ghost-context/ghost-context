/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker deployments
  output: 'standalone',
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
    
    // Ignore react-native modules on the server
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@react-native-async-storage/async-storage': false,
      };
    }
    
    // Ignore indexedDB errors on server
    config.resolve.alias = {
      ...config.resolve.alias,
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
