
export class SimpleHashMultichainClient {
    networkMapping = {}
    constructor() {
        this.networkMapping["ethereum"] = "Ethereum"
        this.networkMapping["polygon"] = "Polygon"
        this.networkMapping["arbitrum"] = "Arbitrum"
        this.networkMapping["optimism"] = "Optimism"
        this.networkMapping["base"] = "Base"
        this.networkMapping["solana"] = "Solana"
        this.networkMapping["gnosis"] = "Gnosis"
        this.networkMapping["zora"] = "Zora"
        this.api_key = process.env.NEXT_PUBLIC_SIMPLEHASH_API_KEY
    }

    getChains() {
        return Object.keys(this.networkMapping);
    }

    async ensReveseLookup(owners) {
        const ownersParams = owners.join('%2c');
        const options = {
            method: 'GET',
            headers: { accept: 'application/json', 'X-API-KEY': this.api_key }
        };

        try {
            const response = await fetch(`https://api.simplehash.com/api/v0/ens/reverse_lookup?wallet_addresses=${ownersParams}`, options)
            const data = await response.json();
            const map = data.reduce((acc, obj) => {
                acc[obj.address] = obj.ens;
                return acc;
            }, {});
            return map;
        } catch (err) {
            console.error(err);
        }
    }

    transformCollection(collection) {
        if (collection.processed) return collection
        collection = collection.collection_details
        return {
            processed: true,
            network: collection.chains[0],
            networkName: this.networkMapping[collection.chains[0]],
            name: collection.name,
            description: collection.description,
            image_small_url: collection.image_url,
            contract_address: collection.collection_id,
        }
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

    async getOwnersByCollection(collectionId, cursor) {
        const options = {
            method: 'GET',
            headers: { accept: 'application/json', 'X-API-KEY': this.api_key }
        };
        try {
            const response = await fetch(`https://api.simplehash.com/api/v0/nfts/owners/collection/${collectionId}?limit=50&cursor=${cursor}`, options)
            let data = await response.json();
            data.owners = data.owners.map(owner => owner.owner_address);
            return data;
        } catch (err) {
            console.error(err);
        }
    }
    async collectionsByOwners(chains, walletId, cursor) {
        const options = {
            method: 'GET',
            headers: { accept: 'application/json', 'X-API-KEY': this.api_key }
        };
        try {
            const response = await fetch(`https://api.simplehash.com/api/v0/nfts/collections_by_wallets_v2?chains=${chains}&cursor=${cursor}&wallet_addresses=${walletId}&spam_score__lte=1&limit=20`, options)
            let data = await response.json();

            // Extract only the required fields
            data.collections = data.collections.map(collection => (this.transformCollection(collection)));

            // If next_cursor is present, call the function recursively
            if (data.next_cursor) {
                const nextData = await this.collectionsByOwners(chains, walletId, data.next_cursor);
                // Combine current data with next data
                nextData.collections = nextData.collections.map(collection => (this.transformCollection(collection)));
                data.collections = [...data.collections, ...nextData.collections];
            }
            return data;
        } catch (err) {
            console.error(err);
        }
    }
    
    async getCollectionsForOwner(walletId) {
        const data = await this.collectionsByOwners(this.getChains(), walletId)
        return data.collections;
    }

}

