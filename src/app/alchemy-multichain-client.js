import { Alchemy, Network } from 'alchemy-sdk';

// Simple in-memory cache to avoid refetching contract metadata repeatedly during a session
const contractMetadataCache = new Map(); // key: `${network}:${contract}` -> { metadata, atMs }
// Reverted: deep acquisition lookup cache (removed for performance)

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
                apiKey:  process.env.NEXT_PUBLIC_ETH_MAIN_API_KEY,
                network: Network.ETH_MAINNET,
            };
        }
        if (!overrides) {
            overrides = {
                [Network.MATIC_MAINNET]: { apiKey: process.env.NEXT_PUBLIC_MATIC_MAIN_API_KEY },
                [Network.ARB_MAINNET]: { apiKey: process.env.NEXT_PUBLIC_ARB_MAIN_API_KEY },
                [Network.OPT_MAINNET]: { apiKey: process.env.NEXT_PUBLIC_OPT_MAIN_API_KEY },
                [Network.BASE_MAINNET]: { apiKey: process.env.NEXT_PUBLIC_BASE_MAIN_API_KEY }
            };
        }
        this.settings = settings;
        this.overrides = overrides;
        this.networkMapping[Network.ETH_MAINNET] = "Ethereum"
        this.networkMapping[Network.MATIC_MAINNET] = "Polygon"
        this.networkMapping[Network.ARB_MAINNET] = "Arbitrum"
        this.networkMapping[Network.OPT_MAINNET] = "Optimism"
        this.networkMapping[Network.BASE_MAINNET] = "Base"
        // Add Zora only if supported by the installed alchemy-sdk version
        if (typeof Network.ZORA_MAINNET !== 'undefined') {
            this.networkMapping[Network.ZORA_MAINNET] = "Zora";
            this.overrides[Network.ZORA_MAINNET] = { apiKey: process.env.NEXT_PUBLIC_ZORA_MAIN_API_KEY };
        }
        // Add POAP as a pseudo-network for event collections
        this.networkMapping["POAP"] = "POAP";
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
        // Only include networks that have an API key configured
        const all = Object.keys(this.networkMapping);
        return all.filter((network) => {
            const hasOverrideKey = !!(this.overrides && this.overrides[network] && this.overrides[network].apiKey);
            const isDefaultWithKey = network === this.settings.network && !!this.settings.apiKey;
            return hasOverrideKey || isDefaultWithKey;
        });
    }

    getNetworkMapping() {
        return this.networkMapping;
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

/**
 * Extend the prototype with helper methods to replace SimpleHash capabilities
 */
AlchemyMultichainClient.prototype.getCollectionsForOwner = async function getCollectionsForOwner(walletAddress, filter = 'relevant', progressCallback = () => {}) {
    const allNetworks = this.getAllNetworks();
    const results = [];
    let debugCount = 0;

    const normalizeImageUrl = (url) => {
        if (!url) return '';
        let v = String(url).trim();
        if (!v) return '';
        if (v.startsWith('ipfs://ipfs/')) v = v.replace('ipfs://ipfs/', 'https://ipfs.io/ipfs/');
        else if (v.startsWith('ipfs://')) v = v.replace('ipfs://', 'https://ipfs.io/ipfs/');
        else if (v.startsWith('ar://')) v = v.replace('ar://', 'https://arweave.net/');
        else if (v.startsWith('//')) v = 'https:' + v;
        else if (!/^https?:\/\//i.test(v)) {
            // If looks like a bare domain path, prefix https, otherwise drop
            if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(v)) v = 'https://' + v;
            else v = '';
        }
        return v;
    };

    await Promise.all(allNetworks.map(async (network) => {
        try {
            const alchemy = this.forNetwork(network);
            const seenContracts = new Set();

            let pageKey = undefined;
            const acquiredAtByContract = new Map(); // earliest acquisition per contract (existing behavior)
            const latestAcquiredAtByContract = new Map(); // newest acquisition per contract
            do {
                // Include metadata so that `mint.timestamp` is populated for accurate acquisition times
                const resp = await alchemy.nft.getNftsForOwner(walletAddress, { pageSize: 100, pageKey, omitMetadata: false });
                for (const owned of resp.ownedNfts || []) {
                    const contract = owned?.contract?.address || owned?.contract?.contractAddress || owned?.contractAddress;
                    if (contract) {
                        const lowered = contract.toLowerCase();
                        seenContracts.add(lowered);
                        const t = owned?.timeLastUpdated;
                        if (t) {
                            const existing = acquiredAtByContract.get(lowered);
                            // keep the earliest date as approximate acquisition time
                            if (!existing || (new Date(t).getTime() < new Date(existing).getTime())) {
                                acquiredAtByContract.set(lowered, t);
                            }
                        }
                        // Track latest acquisition time per contract using mint timestamp if available, else timeLastUpdated
                        const mintTs = owned?.mint?.timestamp || owned?.acquiredAt?.blockTimestamp || owned?.acquiredAt?.timestamp;
                        const latestCandidate = mintTs || t || null;
                        if (latestCandidate) {
                            const prevLatest = latestAcquiredAtByContract.get(lowered);
                            if (!prevLatest || (new Date(latestCandidate).getTime() > new Date(prevLatest).getTime())) {
                                latestAcquiredAtByContract.set(lowered, latestCandidate);
                            }
                        }
                    }
                }
                pageKey = resp.pageKey;
            } while (pageKey);

            const contracts = Array.from(seenContracts);
            const MAX_CONCURRENCY = 8;
            const collectionsForNetwork = [];

            const runWithConcurrency = async (items, limit, worker) => {
                const resultsLocal = [];
                let idx = 0;
                const runners = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
                    while (idx < items.length) {
                        const currentIndex = idx++;
                        const item = items[currentIndex];
                        try {
                            const r = await worker(item, currentIndex);
                            if (r) resultsLocal.push(r);
                        } catch (_) {}
                    }
                });
                await Promise.all(runners);
                return resultsLocal;
            };

            const perContract = await runWithConcurrency(contracts, MAX_CONCURRENCY, async (contract) => {
                try {
                    const cacheKey = `${network}:${contract}`;
                    let cached = contractMetadataCache.get(cacheKey);
                    const now = Date.now();
                    if (!cached || (now - cached.atMs) > 5 * 60 * 1000) { // 5 min TTL
                        const fetched = await alchemy.nft.getContractMetadata(contract);
                        cached = { metadata: fetched, atMs: now };
                        contractMetadataCache.set(cacheKey, cached);
                    }
                    const metadata = cached.metadata;
                    const openSea = metadata?.openSea || {};
                    const name = metadata?.name || openSea?.collectionName || contract;
                    let description = openSea?.description || metadata?.description || '';
                    let imageUrl = openSea?.imageUrl || metadata?.logo || '';

                    const acquiredAt = acquiredAtByContract.get(contract) || null;
                    const acquiredAtLatest = latestAcquiredAtByContract.get(contract) || acquiredAt || null;

                    if (!imageUrl || !description) {
                        try {
                            const sampleResp = await alchemy.nft.getNftsForContract(contract, { pageSize: 1, omitMetadata: false });
                            const first = sampleResp?.nfts?.[0];
                            const media = first?.media?.[0] || {};
                            const raw = first?.rawMetadata || {};
                            if (!imageUrl) {
                                imageUrl = media.thumbnail || media.gateway || raw.image_url || raw.imageUrl || raw.image || first?.tokenUri?.gateway || first?.tokenUri?.raw || '';
                            }
                            if (!description) {
                                description = first?.description || raw.description || '';
                            }
                            const tokenId = first?.id?.tokenId || first?.tokenId;
                            if ((!imageUrl || !description) && tokenId) {
                                const nftMeta = await alchemy.nft.getNftMetadata(contract, tokenId);
                                const m0 = (nftMeta?.media && nftMeta.media[0]) || {};
                                const metaRaw = nftMeta?.metadata || {};
                                if (!imageUrl) {
                                    imageUrl =
                                        m0.thumbnail ||
                                        m0.gateway ||
                                        nftMeta?.image?.cachedUrl ||
                                        nftMeta?.image?.originalUrl ||
                                        metaRaw.image ||
                                        metaRaw.image_url ||
                                        metaRaw.imageUrl ||
                                        nftMeta?.tokenUri?.gateway ||
                                        nftMeta?.tokenUri?.raw ||
                                        '';
                                }
                                if (!description) {
                                    description = nftMeta?.description || metaRaw.description || '';
                                }
                            }
                            if ((!imageUrl || !description) && typeof window !== 'undefined' && debugCount < 10) {
                                debugCount += 1;
                                console.warn('Image derivation debug', {
                                    contract,
                                    network,
                                    contractMetadata: { name: metadata?.name, openSea: metadata?.openSea },
                                    sampleToken: {
                                        tokenId,
                                        media,
                                        raw,
                                        description: first?.description
                                    }
                                });
                            }
                        } catch (_) {}
                    }

                    imageUrl = normalizeImageUrl(imageUrl);

                    return {
                        processed: true,
                        network,
                        chains: [network],
                        networkName: this.getNetworkName(network),
                        name,
                        description,
                        image_small_url: imageUrl,
                        distinct_owner_count: 0,
                        contract_address: contract,
                        large_collection: false,
                        acquired_at: acquiredAt,
                        acquired_at_latest: acquiredAtLatest
                    };
                } catch (_) {
                    return null;
                }
            });

            if (perContract.length) {
                collectionsForNetwork.push(...perContract.filter(Boolean));
            }

            if (collectionsForNetwork.length) {
                progressCallback(collectionsForNetwork.length);
                results.push(...collectionsForNetwork);
            }
        } catch (_) {
            // Skip network on failure
        }
    }));

    // Append POAP event collections for the wallet
    try {
        const urlBase = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
        const url = new URL('/api/poap', urlBase);
        url.searchParams.set('address', walletAddress);
        const res = await fetch(url.toString(), { cache: 'no-store' });
        if (res.ok) {
            const data = await res.json();
            const events = Array.isArray(data?.events) ? data.events : [];
            const mapped = await Promise.all(events.map(async (e) => {
                const id = e?.id;
                let name = e?.name || `POAP ${id}`;
                let description = e?.description || '';
                let imageUrl = e?.image_url || '';
                let ownersCount = 0;
                if (!description || !imageUrl) {
                    try {
                        const detailsUrl = new URL('/api/poap/event/details', urlBase);
                        detailsUrl.searchParams.set('id', String(id));
                        const detailsRes = await fetch(detailsUrl.toString(), { cache: 'no-store' });
                        if (detailsRes.ok) {
                            const d = await detailsRes.json();
                            name = d?.name || name;
                            description = d?.description || description;
                            imageUrl = d?.image_url || imageUrl;
                        }
                    } catch (_) {}
                }
                // Fetch owners count eagerly so tables display immediately
                try {
                    const countUrl = new URL('/api/poap/event', urlBase);
                    countUrl.searchParams.set('id', String(id));
                    countUrl.searchParams.set('countOnly', '1');
                    const countRes = await fetch(countUrl.toString(), { cache: 'no-store' });
                    if (countRes.ok) {
                        const c = await countRes.json();
                        ownersCount = Number(c?.count || 0);
                    }
                } catch (_) {}
                return {
                    processed: true,
                    network: 'POAP',
                    chains: ['POAP'],
                    networkName: this.getNetworkName('POAP'),
                    name,
                    description,
                    image_small_url: imageUrl,
                    distinct_owner_count: ownersCount,
                    contract_address: `poap:${id}`,
                    large_collection: false,
                    acquired_at: e?.created || null,
                    acquired_at_latest: e?.created || null
                };
            }));
            if (mapped.length) {
                progressCallback(mapped.length);
                results.push(...mapped);
            }
        }
    } catch (_) {}

    return results;
};

/**
 * Count distinct owners for a contract with pagination and an upper bound to avoid excessive work.
 */
AlchemyMultichainClient.prototype.getOwnersCountForContract = async function getOwnersCountForContract(network, contractAddress, maxOwnersToCount = 25000) {
    try {
        if (network === 'POAP') {
            const eventId = String(contractAddress || '').startsWith('poap:') ? String(contractAddress).split(':')[1] : String(contractAddress || '');
            if (!eventId) return 0;
            const urlBase = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
            const limitPerPage = 500;
            let total = 0;
            let page = 0;
            while (total < maxOwnersToCount) {
                const url = new URL('/api/poap/event', urlBase);
                url.searchParams.set('id', eventId);
                url.searchParams.set('page', String(page));
                const res = await fetch(url.toString(), { cache: 'no-store' });
                if (!res.ok) break;
                const data = await res.json();
                const holders = Array.isArray(data?.holders) ? data.holders : [];
                total += holders.length;
                if (holders.length < limitPerPage) break;
                page += 1;
            }
            return total;
        }
        const alchemy = this.forNetwork(network);
        let total = 0;
        let pageKey = undefined;
        do {
            const resp = await alchemy.nft.getOwnersForContract(contractAddress, { pageKey });
            const owners = resp?.owners || [];
            total += owners.length;
            if (total >= maxOwnersToCount) {
                return total;
            }
            pageKey = resp.pageKey;
        } while (pageKey);
        return total;
    } catch (e) {
        return 0;
    }
};

/**
 * Fetch the latest inbound transfer timestamp for a given wallet and contract on a specific network.
 * Returns an ISO timestamp string or null if none found.
 */
AlchemyMultichainClient.prototype.getLatestInboundTransferTimestamp = async function getLatestInboundTransferTimestamp(network, contractAddress, walletAddress) {
    try {
        const alchemy = this.forNetwork(network);
        if (!alchemy || !contractAddress || !walletAddress) return null;
        const params = {
            fromBlock: '0x0',
            toAddress: walletAddress,
            contractAddresses: [contractAddress],
            category: ['erc721', 'erc1155'],
            withMetadata: true,
            maxCount: '0x1',
            order: 'desc'
        };
        const resp = await alchemy.core.getAssetTransfers(params).catch(() => null);
        const t = resp && Array.isArray(resp.transfers) ? resp.transfers[0] : null;
        const ts = t && t.metadata ? (t.metadata.blockTimestamp || null) : null;
        return ts || null;
    } catch (_) {
        return null;
    }
};
