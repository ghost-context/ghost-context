// Server-side Alchemy network mapping endpoint
import { Network } from 'alchemy-sdk';

export const dynamic = 'force-dynamic';

// Static mapping - no API key needed
const NETWORK_MAPPING = {
  'ETH_MAINNET': 'Ethereum',
  'MATIC_MAINNET': 'Polygon',
  'ARB_MAINNET': 'Arbitrum',
  'OPT_MAINNET': 'Optimism',
  'BASE_MAINNET': 'Base',
};

// Add ZORA if available
if (typeof Network.ZORA_MAINNET !== 'undefined') {
  NETWORK_MAPPING['ZORA_MAINNET'] = 'Zora';
}

export async function GET() {
  return Response.json({ networks: NETWORK_MAPPING });
}
