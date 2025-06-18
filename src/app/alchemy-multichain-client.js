import { Alchemy, Network } from 'alchemy-sdk';
import { POAPClient } from './poap-client';

/**
 * This is a wrapper around the Alchemy class that allows you to use the same
 * Alchemy object to make requests to multiple networks using different
 * settings.
 *
 * When instantiating this class, you can pass in an `AlchemyMultiChainSettings`
 * object to apply the same settings to all networks. You can also pass in an
 * optional `overrides` object to apply different settings to specific
 * networks.
 */
export class AlchemyMultichainClient {
    settings;
    overrides;
    /**
     * Lazy-loaded mapping of `Network` enum to `Alchemy` instance.
     *
     */
    instances = new Map();

    networkMapping = {}
    BIG_COLLECTION = 50000
    poapClient = new POAPClient()

    /**
     * @param settings The settings to use for all networks.
     * @param overrides Optional settings to use for specific networks.
     */
    constructor(
        settings,
        overrides
    ) {
        if (!settings) {
            settings = {
                apiKey:  process.env.NEXT_PUBLIC_ETH_MAIN_API_KEY,
                network: Network.ETH_MAINNET,
            };
        }
        if (!overrides) {
            overrides = {
                // Core L2s
                [Network.MATIC_MAINNET]: { apiKey: process.env.NEXT_PUBLIC_MATIC_MAIN_API_KEY },
                [Network.ARB_MAINNET]: { apiKey: process.env.NEXT_PUBLIC_ARB_MAIN_API_KEY },
                [Network.OPT_MAINNET]: { apiKey: process.env.NEXT_PUBLIC_OPT_MAIN_API_KEY },
                [Network.BASE_MAINNET]: { apiKey: process.env.NEXT_PUBLIC_BASE_MAIN_API_KEY },
                
                // Additional L1s and L2s - you can add API keys for these as needed
                ...(Network.AVAX_MAINNET && { [Network.AVAX_MAINNET]: { apiKey: process.env.NEXT_PUBLIC_AVAX_MAIN_API_KEY } }),
                ...(Network.GNOSIS_MAINNET && { [Network.GNOSIS_MAINNET]: { apiKey: process.env.NEXT_PUBLIC_GNOSIS_MAIN_API_KEY } }),
                ...(Network.LINEA_MAINNET && { [Network.LINEA_MAINNET]: { apiKey: process.env.NEXT_PUBLIC_LINEA_MAIN_API_KEY } }),
                ...(Network.CELO_MAINNET && { [Network.CELO_MAINNET]: { apiKey: process.env.NEXT_PUBLIC_CELO_MAIN_API_KEY } }),
                // Add more as needed - most can use the same API key as ETH mainnet
            };
        }
        this.settings = settings;
        this.overrides = overrides;
        
        // Core networks that SimpleHash supported and Alchemy supports
        this.networkMapping[Network.ETH_MAINNET] = "Ethereum"
        this.networkMapping[Network.MATIC_MAINNET] = "Polygon"
        this.networkMapping[Network.ARB_MAINNET] = "Arbitrum"
        this.networkMapping[Network.OPT_MAINNET] = "Optimism"
        this.networkMapping[Network.BASE_MAINNET] = "Base"
        
        // Additional networks that Alchemy supports
        if (Network.AVAX_MAINNET) this.networkMapping[Network.AVAX_MAINNET] = "Avalanche"
        if (Network.GNOSIS_MAINNET) this.networkMapping[Network.GNOSIS_MAINNET] = "Gnosis"
        if (Network.LINEA_MAINNET) this.networkMapping[Network.LINEA_MAINNET] = "Linea"
        if (Network.POLYGONZKEVM_MAINNET) this.networkMapping[Network.POLYGONZKEVM_MAINNET] = "Polygon zkEVM"
        if (Network.STARKNET_MAINNET) this.networkMapping[Network.STARKNET_MAINNET] = "Starknet"
        if (Network.ZETACHAIN_MAINNET) this.networkMapping[Network.ZETACHAIN_MAINNET] = "ZetaChain"
        if (Network.BLAST_MAINNET) this.networkMapping[Network.BLAST_MAINNET] = "Blast"
        if (Network.ZKSYNC_MAINNET) this.networkMapping[Network.ZKSYNC_MAINNET] = "zkSync"
        if (Network.SCROLL_MAINNET) this.networkMapping[Network.SCROLL_MAINNET] = "Scroll"
        if (Network.MANTLE_MAINNET) this.networkMapping[Network.MANTLE_MAINNET] = "Mantle"
        if (Network.CELO_MAINNET) this.networkMapping[Network.CELO_MAINNET] = "Celo"
        if (Network.METIS_MAINNET) this.networkMapping[Network.METIS_MAINNET] = "Metis"
        if (Network.ARB_NOVA) this.networkMapping[Network.ARB_NOVA] = "Arbitrum Nova"
        if (Network.ASTAR_MAINNET) this.networkMapping[Network.ASTAR_MAINNET] = "Astar"
        
        // Note: Some networks from SimpleHash are not supported by Alchemy:
        // - Bitcoin (different architecture)
        // - Solana (different architecture, has separate Alchemy support)
        // - Zora (would need custom RPC)
        // - Manta (would need custom RPC) 
        // - Loot (would need custom RPC)
    }

    get nft() {
        return new Proxy({}, {
            get: (target, prop) => {
                const alchemy = this.forNetwork(this.settings.network);
                if (alchemy && typeof alchemy.nft[prop] === 'function') {
                    return alchemy.nft[prop].bind(alchemy.nft);
                }
                return undefined;
            }
        });
    }

    get core() {
        return new Proxy({}, {
            get: (target, prop) => {
                const alchemy = this.forNetwork(this.settings.network);
                if (alchemy && typeof alchemy.core[prop] === 'function') {
                    return alchemy.core[prop].bind(alchemy.core);
                }
                return undefined;
            }
        });
    }

    getChains() {
        return Object.keys(this.networkMapping);
    }

    getAllNetworks() {
        return Object.keys(this.networkMapping);
    }

    getNetworkMapping() {
        return this.networkMapping;
    }

    getNetworkName(networkId) {
        return this.networkMapping[networkId] || networkId;
    }

    /**
     * ENS reverse lookup - gets ENS names for wallet addresses
     */
    async ensReveseLookup(owners) {
        const map = {};
        try {
            // Alchemy doesn't have batch ENS lookup, so we'll do individual lookups
            const promises = owners.map(async (address) => {
                try {
                    const ensName = await this.forNetwork(Network.ETH_MAINNET).core.lookupAddress(address);
                    return { address, ens: ensName };
                } catch (err) {
                    return { address, ens: null };
                }
            });
            
            const results = await Promise.all(promises);
            results.forEach(result => {
                map[result.address] = result.ens;
            });
            return map;
        } catch (err) {
            console.error('ENS reverse lookup error:', err);
            return map;
        }
    }

    /**
     * Check if collection appears to be spam
     */
    spaminName(collection) {
        const spamIndicators = ["winner", "voucher", "reward", "$"];
        return spamIndicators.some(indicator =>
            collection.name?.toLowerCase().includes(indicator)
        )
    }

    spaminDescription(collection) {
        const spamIndicators = ["winner", "voucher", "$"];
        return spamIndicators.some(indicator =>
            collection.description?.toLowerCase().includes(indicator)
        )
    }

    /**
     * Transform Alchemy collection data to match SimpleHash format
     */
    async transformCollection(collection, network) {
        if (collection.processed) return collection;
        
        const isSpam = this.spaminName(collection) || this.spaminDescription(collection);
        
        return {
            processed: true,
            network: network,
            chains: [network],
            networkName: this.networkMapping[network],
            name: collection.name || 'Unknown Collection',
            description: `${collection.description || ''} `,
            image_small_url: collection.image?.cachedUrl || collection.image?.originalUrl,
            distinct_owner_count: 0, // Alchemy doesn't provide this directly
            contract_address: collection.address,
            large_collection: isSpam
        }
    }

    /**
     * Get NFT by ID - equivalent to SimpleHash getNTFbyId
     */
    async getNTFbyId(chain, contract, token) {
        try {
            const networkMap = {
                'ethereum': Network.ETH_MAINNET,
                'polygon': Network.MATIC_MAINNET,
                'arbitrum': Network.ARB_MAINNET,
                'optimism': Network.OPT_MAINNET,
                'base': Network.BASE_MAINNET
            };
            
            const network = networkMap[chain] || Network.ETH_MAINNET;
            const nft = await this.forNetwork(network).nft.getNftMetadata(contract, token);
            
            return {
                name: nft.title,
                description: nft.description,
                image_url: nft.image?.cachedUrl || nft.image?.originalUrl
            };
        } catch (err) {
            console.error('Error getting NFT by ID:', err);
            return null;
        }
    }

    /**
     * Get owners by collection
     */
    async getOwnersByCollection(collectionId, cursor) {
        try {
            // Alchemy's getOwnersForContract with pagination
            const data = await this.forNetwork(this.settings.network).nft.getOwnersForContract(
                collectionId,
                { 
                    pageKey: cursor,
                    pageSize: 100 
                }
            );
            
            return {
                owners: data.owners,
                next_cursor: data.pageKey
            };
        } catch (err) {
            console.error('Error getting owners by collection:', err);
            return { owners: [], next_cursor: null };
        }
    }

    /**
     * Get owners - handles both POAP events and regular collections
     */
    async getOwners(type, id, cursor) {
        if (type === "poap") {
            return await this.poapClient.getOwners(type, id, cursor);
        } else {
            return await this.getOwnersByCollection(id, cursor);
        }
    }

    /**
     * Check if a network is supported by Alchemy
     */
    isNetworkSupported(networkString) {
        // Convert string network names to check support
        const networkMap = {
            'ethereum': Network.ETH_MAINNET,
            'polygon': Network.MATIC_MAINNET,
            'arbitrum': Network.ARB_MAINNET,
            'optimism': Network.OPT_MAINNET,
            'base': Network.BASE_MAINNET,
            'avalanche': Network.AVAX_MAINNET,
            'gnosis': Network.GNOSIS_MAINNET,
            'linea': Network.LINEA_MAINNET,
            'celo': Network.CELO_MAINNET,
        };
        
        return !!networkMap[networkString];
    }

    /**
     * Get alternative providers for unsupported networks
     */
    getUnsupportedNetworkMessage(networkString) {
        const alternatives = {
            'bitcoin': 'Bitcoin is not EVM-compatible. Consider using Blockstream API or similar Bitcoin-specific APIs.',
            'solana': 'Solana has separate Alchemy support. Use Alchemy Solana APIs or Solana Web3.js.',
            'zora': 'Zora Network - consider using Zora API directly or public RPC endpoints.',
            'manta': 'Manta Network - consider using Manta public RPC or specialized providers.',
            'loot': 'Loot Network - consider using public RPC endpoints or specialized providers.'
        };
        
        return alternatives[networkString] || `Network '${networkString}' is not supported by Alchemy. Consider using public RPC endpoints or specialized providers.`;
    }

    /**
     * Get collections for owner - equivalent to SimpleHash getCollectionsForOwner
     */
    async getCollectionsForOwner(walletId, filter, callback) {
        const allCollections = [];
        
        try {
            // Get NFTs for each supported network
            for (const [network, networkName] of Object.entries(this.networkMapping)) {
                try {
                    callback = callback || (() => {}); // Default callback
                    
                    let pageKey = null;
                    let hasMore = true;
                    
                    while (hasMore) {
                        const nfts = await this.forNetwork(network).nft.getNftsForOwner(
                            walletId,
                            {
                                pageKey: pageKey,
                                pageSize: 100,
                                excludeFilters: filter === 'relevant' ? ['SPAM'] : []
                            }
                        );
                        
                        // Group NFTs by contract to create collections
                        const contractMap = new Map();
                        
                        nfts.ownedNfts.forEach(nft => {
                            const contractAddress = nft.contract.address;
                            if (!contractMap.has(contractAddress)) {
                                contractMap.set(contractAddress, {
                                    name: nft.contract.name || nft.contract.symbol || 'Unknown',
                                    description: nft.description || '',
                                    address: contractAddress,
                                    image: nft.contract.openSeaMetadata?.imageUrl || nft.image?.cachedUrl,
                                    nftCount: 0
                                });
                            }
                            contractMap.get(contractAddress).nftCount++;
                        });
                        
                        // Transform to match SimpleHash format
                        for (const collection of contractMap.values()) {
                            const transformedCollection = await this.transformCollection(collection, network);
                            allCollections.push(transformedCollection);
                        }
                        
                        callback(contractMap.size);
                        
                        pageKey = nfts.pageKey;
                        hasMore = !!pageKey;
                    }
                } catch (networkErr) {
                    console.error(`Error fetching from ${networkName}:`, networkErr);
                    // Continue with other networks
                }
            }
            
            // Also get POAP events
            try {
                const poapEvents = await this.poapClient.eventsByOwner(walletId, null, callback);
                allCollections.push(...poapEvents.nfts);
            } catch (poapErr) {
                console.error('Error fetching POAP events:', poapErr);
            }
            
            return allCollections;
        } catch (err) {
            console.error('Error getting collections for owner:', err);
            return [];
        }
    }

    /**
     * Returns an instance of `Alchemy` for the given `Network`.
     *
     * @param network
     */
    forNetwork(network) {
        return this.loadInstance(network);
    }

    /**
     * Checks if an instance of `Alchemy` exists for the given `Network`. If not,
     * it creates one and stores it in the `instances` map.
     *
     * @private
     * @param network
     */
    loadInstance(network) {
        if (!this.instances.has(network)) {
            // Use overrides if they exist -- otherwise use the default settings.
            const alchemySettings =
                this.overrides && this.overrides[network]
                    ? { ...this.overrides[network], network }
                    : { ...this.settings, network };
            this.instances.set(network, new Alchemy(alchemySettings));
        }
        return this.instances.get(network);
    }
}
