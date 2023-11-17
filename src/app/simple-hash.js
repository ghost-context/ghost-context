
export class SimpleHashMultichainClient {
    networkMapping = {}
    BIG_COLLECTION = 50000
    constructor() {
        this.networkMapping["poap"] = "POAP"
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
        return Object.keys(this.networkMapping).filter(chain => chain !== 'poap');
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
            description: `${collection.description??''} contains ${collection.distinct_owner_count} owners `,
            image_small_url: collection.image_url,
            contract_address: collection.collection_id,
            large_collection: collection.distinct_owner_count > this.BIG_COLLECTION
        }
    }

    transformEvent(nft) {
        if (nft.processed) return nft
        return {
            processed: true,
            network: "poap",
            networkName: "POAP",
            name: nft.name,
            description: nft.description??'',
            image_small_url: nft.image_url,
            contract_address: nft.extra_metadata?.event_id,
            large_collection: false
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

    async getOwners(type, id, cursor) {
        if( type == "poap") {
            return await this.getOwnersByEvent(id, cursor)
        } else {
            return await this.getOwnersByCollection(id, cursor)
        }
    }

    async getOwnersByEvent(eventId, cursor) {
        const options = {
            method: 'GET',
            headers: { accept: 'application/json', 'X-API-KEY': this.api_key }
        };
        try {
            const response = await fetch(`https://api.simplehash.com/api/v0/nfts/poap_event/${eventId}?limit=50&cursor=${cursor}`, options)
            let data = await response.json();
            data.owners = data.nfts.map(nft => nft.owners.map(owner => owner.owner_address));
            return data;
        } catch (err) {
            console.error(err);
        }
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
            const response = await fetch(`https://api.simplehash.com/api/v0/nfts/collections_by_wallets_v2?chains=${chains}&cursor=${cursor}&wallet_addresses=${walletId}&spam_score__lte=99&limit=20`, options)
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

    async eventsByOwner(walletId, cursor) {
        const options = {
            method: 'GET',
            headers: { accept: 'application/json', 'X-API-KEY': this.api_key }
        };
        try {
            const response = await fetch(`https://api.simplehash.com/api/v0/nfts/owners?chains=gnosis,ethereum&wallet_addresses=${walletId}&contract_addresses=0x22C1f6050E56d2876009903609a2cC3fEf83B415&cursor=${cursor}&limit=50`, options)
            let data = await response.json();

            // Extract only the required fields
            data.nfts = data.nfts.map(collection => (this.transformEvent(collection)));

            // If next_cursor is present, call the function recursively
            if (data.next_cursor) {
                const nextData = await this.eventsByOwner(walletId, data.next_cursor);
                // Combine current data with next data
                nextData.nfts = nextData.nfts.map(nft => (this.transformEvent(nft)));
                data.nfts = [...data.nfts, ...nextData.nfts];
            }
            return data;
        } catch (err) {
            console.error(err);
        }
    }
    
    async getCollectionsForOwner(walletId) {
        const data = await this.collectionsByOwners(this.getChains(), walletId)
        const events = await this.eventsByOwner(walletId)
        return [...data.collections,...events.nfts]
    }

}

