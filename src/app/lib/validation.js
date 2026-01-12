/**
 * Validation utilities for Web3 addresses and inputs
 */

// Ethereum address format: 0x followed by 40 hex characters
const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

// ENS name format: alphanumeric with hyphens/dots, ending in .eth
const ENS_NAME_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.eth$/;

/**
 * Check if string is a valid Ethereum address
 * @param {string} address - Address to validate
 * @returns {boolean}
 */
export function isValidAddress(address) {
  return ETH_ADDRESS_REGEX.test(address);
}

/**
 * Check if string is a valid ENS name
 * @param {string} name - ENS name to validate
 * @returns {boolean}
 */
export function isValidENS(name) {
  return ENS_NAME_REGEX.test(name);
}

/**
 * Check if string is either a valid address or ENS name
 * @param {string} input - Address or ENS name
 * @returns {boolean}
 */
export function isValidAddressOrENS(input) {
  return isValidAddress(input) || isValidENS(input);
}

/**
 * Validate address parameter and return error response if invalid
 * @param {string} address - Address to validate
 * @returns {Response|null} Error response if invalid, null if valid
 */
export function validateAddressParam(address) {
  if (!address) {
    return new Response(
      JSON.stringify({ error: 'Missing address parameter' }),
      { status: 400, headers: { 'content-type': 'application/json' } }
    );
  }

  if (!isValidAddressOrENS(address)) {
    return new Response(
      JSON.stringify({ error: 'Invalid address format. Expected Ethereum address (0x...) or ENS name (*.eth)' }),
      { status: 400, headers: { 'content-type': 'application/json' } }
    );
  }

  return null;
}

/**
 * Check if a POAP event ID is valid (numeric string)
 * @param {string} id - Event ID to validate
 * @returns {boolean}
 */
export function isValidEventId(id) {
  return /^\d+$/.test(id);
}
