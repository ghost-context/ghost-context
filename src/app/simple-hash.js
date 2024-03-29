
export class SimpleHashMultichainClient {
    networkMapping = {}
    BIG_COLLECTION = 50000
    constructor() {
        this.networkMapping["poap"] = "POAP"
        this.networkMapping["ethereum"] = "Ethereum"
        this.networkMapping["polygon"] = "Polygon"
        this.networkMapping["bitcoin"] = "Bitcoin"
        this.networkMapping["arbitrum"] = "Arbitrum"
        this.networkMapping["optimism"] = "Optimism"
        this.networkMapping["base"] = "Base"
        this.networkMapping["solana"] = "Solana"
        this.networkMapping["gnosis"] = "Gnosis"
        this.networkMapping["zora"] = "Zora"
        this.networkMapping["avalanche"] = "Avalanche"
        this.networkMapping["celo"] = "Celo"
        this.networkMapping["linea"] = "Linea"
        this.networkMapping["manta"] = "Manta"
        this.networkMapping["loot"] = "Loot"
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
            const data = await this.fetchWithBackoff(`https://api.simplehash.com/api/v0/ens/reverse_lookup?wallet_addresses=${ownersParams}`, options)
            const map = data.reduce((acc, obj) => {
                acc[obj.address] = obj.ens;
                return acc;
            }, {});
            return map;
        } catch (err) {
            console.error(err);
        }
    }

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

    async transformCollection(collection) {
        if (collection.processed) return collection
        let nft_ids = collection.nft_ids;
        collection = collection.collection_details
        let isSpam = this.spaminName(collection) || this.spaminDescription(collection)
        if(!collection.image_url && nft_ids && nft_ids.length && !isSpam) {
            //We dont have collection data, lets get it from the nft
            let nft_id = nft_ids[0]
            //Split to chain, id and token by dot
            let [chain, contract, token] = nft_id.split('.');
            let data = await this.getNTFbyId(chain,contract,token)
            if(data) {
                collection.name = data.name
                collection.image_url = data.image_url
                collection.description = data.description
            }
        }
        isSpam = this.spaminName(collection) || this.spaminDescription(collection)
        return {
            processed: true,
            network: collection.chains[0],
            chains: collection.chains,
            networkName: this.networkMapping[collection.chains[0]],
            name: collection.name,
            description: `${collection.description??''} contains ${collection.distinct_owner_count} owners `,
            image_small_url: collection.image_url,
            distinct_owner_count: collection.distinct_owner_count,
            contract_address: collection.collection_id,
            large_collection: (collection.distinct_owner_count > this.BIG_COLLECTION) || isSpam
        }
    }

    transformEvent(nft) {
        if (nft.processed) return nft
        return {
            processed: true,
            network: "poap",
            chains: ["poap"],
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

    async getNTFbyId(chain,contract,token) {
        const options = {
            method: 'GET',
            headers: { accept: 'application/json', 'X-API-KEY': this.api_key }
        };
        try {
            const data = await this.fetchWithBackoff(`https://api.simplehash.com/api/v0/nfts/${chain}/${contract}/${token}`, options)
            let {name,description,image_url} = data;
            return {name,description,image_url};
        } catch (err) {
            console.error(err);
        }
    }

    async getOwnersByEvent(eventId, cursor) {
        const options = {
            method: 'GET',
            headers: { accept: 'application/json', 'X-API-KEY': this.api_key }
        };
        try {
            const data = await this.fetchWithBackoff(`https://api.simplehash.com/api/v0/nfts/poap_event/${eventId}?limit=50&cursor=${cursor}`, options)
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
            const data = await this.fetchWithBackoff(`https://api.simplehash.com/api/v0/nfts/owners/collection/${collectionId}?limit=1000&cursor=${cursor}`, options)
            data.owners = data.owners.map(owner => owner.owner_address);
            return data;
        } catch (err) {
            console.error(err);
        }
    }

    async fetchWithBackoff(url, options, retries = 10, backoff = 300) {
        try {
          const response = await fetch(url, options);
          if (!response.ok) {
            if (response.status === 429 && retries > 0) {
              // Wait for the backoff duration before retrying
              await new Promise(resolve => setTimeout(resolve, backoff));
              // Retry the fetch with an increased backoff and one less retry
              return await this.fetchWithBackoff(url, options, retries - 1, backoff * 2);
            }
            throw new Error(`Request failed with status: ${response.status}`);
          }
          return await response.json();
        } catch (error) {
          console.error('Fetch failed:', error);
          throw error;
        }
      }
      
     async collectionsByOwners(chains, walletId, filter, cursor, callback) {
        const options = {
            method: 'GET',
            headers: { accept: 'application/json', 'X-API-KEY': this.api_key }
        };
        const spamFilter =  filter == 'relevant' ? '&spam_score__lte=99' : ''
        try {
            const data = await this.fetchWithBackoff(`https://api.simplehash.com/api/v0/nfts/collections_by_wallets_v2?nft_ids=1&chains=${chains}&cursor=${cursor}${spamFilter}&wallet_addresses=${walletId}&limit=50`, options)

            // Extract only the required fields
            data.collections = await Promise.all(data.collections.map(collection => this.transformCollection(collection)));
            callback(data.collections.length);
            // If next_cursor is present, call the function recursively
            if (data.next_cursor) {
                const nextData = await this.collectionsByOwners(chains, walletId, filter, data.next_cursor, callback);
                // Combine current data with next data
                nextData.collections = await Promise.all(nextData.collections.map(collection => this.transformCollection(collection)));
                data.collections = [...data.collections, ...nextData.collections];
            }
            return data;
        } catch (err) {
            console.error(err);
        }
    }

    async eventsByOwner(walletId, cursor, callback) {
        const options = {
            method: 'GET',
            headers: { accept: 'application/json', 'X-API-KEY': this.api_key }
        };
        try {
            const data = await this.fetchWithBackoff(`https://api.simplehash.com/api/v0/nfts/owners?chains=gnosis,ethereum&wallet_addresses=${walletId}&contract_addresses=0x22C1f6050E56d2876009903609a2cC3fEf83B415&cursor=${cursor}&limit=50`, options)

            // Extract only the required fields
            data.nfts = data.nfts.map(collection => (this.transformEvent(collection)));
            callback(data.nfts.length)

            // If next_cursor is present, call the function recursively
            if (data.next_cursor) {
                const nextData = await this.eventsByOwner(walletId, data.next_cursor, callback);
                // Combine current data with next data
                nextData.nfts = nextData.nfts.map(nft => (this.transformEvent(nft)));
                data.nfts = [...data.nfts, ...nextData.nfts];
            }
            return data;
        } catch (err) {
            console.error(err);
        }
    }
    
    async getCollectionsForOwner(walletId, filter, callback) {
        const data = await this.collectionsByOwners(this.getChains(), walletId, filter, null, callback)
        const events = await this.eventsByOwner(walletId,null,callback)
        return [...data.collections,...events.nfts]
    }

}

