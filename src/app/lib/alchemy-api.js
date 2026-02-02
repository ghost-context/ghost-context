// Client-side wrapper for server-side Alchemy API routes
// Use this instead of AlchemyMultichainClient in browser code

/**
 * Fetch NFT collections for a wallet address
 * @param {string} address - Wallet address
 * @param {string} filter - Filter type ('relevant' or 'all')
 * @param {string[]|null} networks - Optional list of networks to query
 * @returns {Promise<Array>} - Collection objects
 */
export async function getCollectionsForOwner(address, filter = 'relevant', networks = null) {
  const params = new URLSearchParams({ address, filter });
  if (networks && networks.length > 0) {
    params.set('networks', networks.join(','));
  }

  const res = await fetch(`/api/alchemy/collections?${params}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Failed to fetch collections');
  }

  const data = await res.json();
  return data.collections || [];
}

/**
 * Get owner count for an NFT contract
 * @param {string} network - Network name (e.g., 'ETH_MAINNET')
 * @param {string} contract - Contract address
 * @param {number} maxCount - Maximum owners to count
 * @returns {Promise<number>} - Owner count
 */
export async function getOwnersCountForContract(network, contract, maxCount = 25000) {
  const params = new URLSearchParams({ network, contract, maxCount: String(maxCount) });

  const res = await fetch(`/api/alchemy/owners-count?${params}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Failed to fetch owner count');
  }

  const data = await res.json();
  return data.ownerCount || 0;
}

/**
 * Get owners for an NFT contract (paginated)
 * @param {string} network - Network name
 * @param {string} contract - Contract address
 * @param {string|null} pageKey - Pagination key
 * @returns {Promise<{owners: string[], pageKey: string|null}>}
 */
export async function getOwnersForContract(network, contract, pageKey = null) {
  const params = new URLSearchParams({ network, contract });
  if (pageKey) {
    params.set('pageKey', pageKey);
  }

  const res = await fetch(`/api/alchemy/owners?${params}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Failed to fetch owners');
  }

  return res.json();
}

/**
 * Get all owners for an NFT contract (handles pagination)
 * @param {string} network - Network name
 * @param {string} contract - Contract address
 * @param {number} maxOwners - Maximum owners to fetch
 * @returns {Promise<string[]>} - Array of owner addresses
 */
export async function getAllOwnersForContract(network, contract, maxOwners = 150000) {
  let allOwners = [];
  let pageKey = null;

  do {
    const result = await getOwnersForContract(network, contract, pageKey);
    allOwners = allOwners.concat(result.owners || []);
    pageKey = result.pageKey;

    if (allOwners.length >= maxOwners) {
      break;
    }
  } while (pageKey);

  return allOwners;
}

/**
 * Get network mapping (network key -> display name)
 * @returns {Promise<Object>} - Mapping of network keys to names
 */
export async function getNetworkMapping() {
  const res = await fetch('/api/alchemy/network-mapping');
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Failed to fetch network mapping');
  }

  const data = await res.json();
  return data.networks || {};
}

/**
 * Resolve ENS name to address
 * @param {string} name - ENS name to resolve
 * @returns {Promise<string|null>} - Resolved address or null
 */
export async function resolveName(name) {
  const params = new URLSearchParams({ name });

  const res = await fetch(`/api/alchemy/resolve-name?${params}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Failed to resolve name');
  }

  const data = await res.json();
  return data.address;
}

/**
 * Get latest inbound transfer timestamp for a contract/owner
 * @param {string} network - Network name
 * @param {string} contract - Contract address
 * @param {string} owner - Owner address
 * @returns {Promise<string|null>} - ISO timestamp or null
 */
export async function getLatestInboundTransferTimestamp(network, contract, owner) {
  const params = new URLSearchParams({ network, contract, owner });

  const res = await fetch(`/api/alchemy/latest-inbound?${params}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Failed to fetch transfer timestamp');
  }

  const data = await res.json();
  return data.timestamp;
}

/**
 * Get NFTs for an owner with optional contract filter
 * @param {string} owner - Owner address
 * @param {Object} options - Options including contractAddresses, network, pageKey
 * @returns {Promise<{ownedNfts: Array, pageKey: string|null, totalCount: number}>}
 */
export async function getNftsForOwner(owner, options = {}) {
  const params = new URLSearchParams({ owner });

  if (options.network) {
    params.set('network', options.network);
  }
  if (options.contractAddresses && options.contractAddresses.length > 0) {
    params.set('contractAddresses', options.contractAddresses.join(','));
  }
  if (options.pageKey) {
    params.set('pageKey', options.pageKey);
  }

  const res = await fetch(`/api/alchemy/nfts-for-owner?${params}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Failed to fetch NFTs');
  }

  return res.json();
}

/**
 * Get contract metadata
 * @param {string} network - Network name
 * @param {string} contract - Contract address
 * @returns {Promise<Object>} - Contract metadata
 */
export async function getContractMetadata(network, contract) {
  const params = new URLSearchParams({ network, contract });

  const res = await fetch(`/api/alchemy/contract-metadata?${params}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Failed to fetch contract metadata');
  }

  return res.json();
}
