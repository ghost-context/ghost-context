
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

    transformNft (nft) {
        if(nft.processed) return nft
        nft = nft.collection_details
        return {
            processed: true,
            network: nft.chains[0],
            networkName: this.networkMapping[nft.chains[0]],
            name: nft.name,
            description: nft.description,
            image_small_url:  nft.image_url,
            contract_address: nft.collection_id,
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

    async nftsByOwners(chains, walletId, cursor) {
        const options = {
            method: 'GET',
            headers: { accept: 'application/json', 'X-API-KEY': this.api_key }
        };
        try {
            const response = await fetch(`https://api.simplehash.com/api/v0/nfts/collections_by_wallets_v2?chains=${chains}&cursor=${cursor}&wallet_addresses=${walletId}&spam_score__lte=1&limit=20`, options)
            let data = await response.json();
    
            // Extract only the required fields
            data.collections = data.collections.map(nft => (this.transformNft(nft)));
    
            // If next_cursor is present, call the function recursively
            if (data.next_cursor) {
                const nextData = await this.nftsByOwners(chains, walletId, data.next_cursor);
                // Combine current data with next data
                nextData.collections = nextData.collections.map(nft => (this.transformNft(nft)));
                data.collections = [...data.collections, ...nextData.collections];
            }
    
            return data;
        } catch (err) {
            console.error(err);
        }
    }
    async getNftsForOwner(walletId) {

        const data = await this.nftsByOwners(this.getChains(),walletId)
        return data.collections;
    }
}

