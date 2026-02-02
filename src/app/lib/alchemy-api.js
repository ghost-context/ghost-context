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
