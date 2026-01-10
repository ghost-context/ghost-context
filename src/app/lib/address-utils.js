/**
 * Address formatting utilities
 */

/**
 * Shorten an Ethereum address to 0x1234...5678 format
 * @param {string} address - Full Ethereum address
 * @param {number} prefixLen - Characters to show at start (default 4)
 * @param {number} suffixLen - Characters to show at end (default 4)
 * @returns {string} Shortened address
 */
export function shortenAddress(address, prefixLen = 4, suffixLen = 4) {
  if (!address || address.length < prefixLen + suffixLen + 3) {
    return address || '';
  }
  const prefix = address.slice(0, prefixLen);
  const suffix = address.slice(-suffixLen);
  return `${prefix}...${suffix}`;
}

/**
 * Format address for display - use ENS name if available, otherwise shorten
 * @param {string} address - Ethereum address
 * @param {string|null} ensName - ENS name if resolved
 * @returns {string} Display string
 */
export function formatAddressOrENS(address, ensName) {
  if (ensName) {
    return ensName;
  }
  return shortenAddress(address);
}
