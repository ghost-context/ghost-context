import { Alchemy, Network } from 'alchemy-sdk';

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
                apiKey:  process.env.ALCHEMY_ETH_MAIN_API_KEY,
                network: Network.ETH_MAINNET,
            };
        }
        if (!overrides) {
            overrides = {
                [Network.MATIC_MAINNET]: { apiKey: process.env.ALCHEMY_MATIC_MAIN_API_KEY, maxRetries: 10 },
                [Network.ARB_MAINNET]: { apiKey: process.env.ALCHEMY_ARB_MAIN_API_KEY },
                [Network.OPT_MAINNET]: { apiKey: process.env.ALCHEMY_OPT_MAIN_API_KEY },
                [Network.BASE_MAINNET]: { apiKey: process.env.ALCHEMY_BASE_MAIN_API_KEY }
            };
        }
        this.settings = settings;
        this.overrides = overrides;
        this.networkMapping[Network.ETH_MAINNET] = "Ethereum"
        this.networkMapping[Network.MATIC_MAINNET] = "Polygon"
        this.networkMapping[Network.ARB_MAINNET] = "Arbitrum"
        this.networkMapping[Network.OPT_MAINNET] = "Optimism"
        this.networkMapping[Network.BASE_MAINNET] = "Base"
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

    getAllNetworks() {
        const settingsNetwork = this.settings.network;
        const overridesNetworks = Object.keys(this.overrides);
        return [...new Set([settingsNetwork, ...overridesNetworks])];
    }

    getNetworkName(networkId) {
        return this.networkMapping[networkId] || networkId;
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
