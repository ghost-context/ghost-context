export class AlliumMultichainClient {
    constructor() {
        this.networkMapping = {
            "ethereum": "Ethereum",
            "polygon": "Polygon", 
            "arbitrum": "Arbitrum",
            "optimism": "Optimism",
            "base": "Base",
            "solana": "Solana",
            "bitcoin": "Bitcoin",
            "avalanche": "Avalanche",
            "bsc": "BSC",
            "fantom": "Fantom"
        };
        this.api_key = process.env.NEXT_PUBLIC_ALLIUM_API_KEY;
        this.base_url = "https://api.allium.so/api/v1";
    }

    getChains() {
        return Object.keys(this.networkMapping);
    }

    getNetworkName(networkId) {
        return this.networkMapping[networkId] || networkId;
    }

    async fetchWithBackoff(url, options, retries = 3, backoff = 1000) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                if (response.status === 429 && retries > 0) {
                    await new Promise(resolve => setTimeout(resolve, backoff));
                    return await this.fetchWithBackoff(url, options, retries - 1, backoff * 2);
                }
                throw new Error(`Request failed with status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Allium API fetch failed:', error);
            throw error;
        }
    }

    async makeRequest(endpoint, params = {}) {
        const url = new URL(`${this.base_url}${endpoint}`);
        
        // Add API key to headers
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.api_key}`
            },
            body: JSON.stringify(params)
        };

        return await this.fetchWithBackoff(url.toString(), options);
    }

    // NFT Methods
    async getNFTsByOwner(walletAddress, chain = 'ethereum') {
        try {
            const data = await this.makeRequest('/nft/balances', {
                address: walletAddress,
                chain: chain
            });
            
            return this.transformNFTResponse(data, chain);
        } catch (error) {
            console.error('Error fetching NFTs by owner:', error);
            throw error;
        }
    }

    async getNFTMetadata(contractAddress, tokenId, chain = 'ethereum') {
        try {
            const data = await this.makeRequest('/nft/metadata', {
                contract_address: contractAddress,
                token_id: tokenId,
                chain: chain
            });

            return this.transformNFTMetadata(data, chain);
        } catch (error) {
            console.error('Error fetching NFT metadata:', error);
            throw error;
        }
    }

    async getNFTCollectionData(contractAddress, chain = 'ethereum') {
        try {
            const data = await this.makeRequest('/nft/collection', {
                contract_address: contractAddress,
                chain: chain
            });

            return this.transformCollectionData(data, chain);
        } catch (error) {
            console.error('Error fetching NFT collection data:', error);
            throw error;
        }
    }

    // Token Methods
    async getTokenBalances(walletAddress, chain = 'ethereum') {
        try {
            const data = await this.makeRequest('/tokens/balances', {
                address: walletAddress,
                chain: chain
            });

            return this.transformTokenBalances(data, chain);
        } catch (error) {
            console.error('Error fetching token balances:', error);
            throw error;
        }
    }

    async getTokenPrices(tokenAddresses, chain = 'ethereum') {
        try {
            const data = await this.makeRequest('/tokens/prices', {
                tokens: tokenAddresses,
                chain: chain
            });

            return data;
        } catch (error) {
            console.error('Error fetching token prices:', error);
            throw error;
        }
    }

    // Transaction Methods
    async getTransactionHistory(walletAddress, chain = 'ethereum', limit = 50) {
        try {
            const data = await this.makeRequest('/transactions', {
                address: walletAddress,
                chain: chain,
                limit: limit
            });

            return this.transformTransactionHistory(data, chain);
        } catch (error) {
            console.error('Error fetching transaction history:', error);
            throw error;
        }
    }

    // Cross-chain wallet analysis
    async getWalletProfile(walletAddress) {
        try {
            const chains = this.getChains();
            const profiles = await Promise.allSettled(
                chains.map(async (chain) => {
                    try {
                        const [nfts, tokens, transactions] = await Promise.all([
                            this.getNFTsByOwner(walletAddress, chain),
                            this.getTokenBalances(walletAddress, chain),
                            this.getTransactionHistory(walletAddress, chain, 10)
                        ]);

                        return {
                            chain,
                            networkName: this.getNetworkName(chain),
                            nfts: nfts || [],
                            tokens: tokens || [],
                            transactions: transactions || [],
                            active: (nfts?.length > 0) || (tokens?.length > 0) || (transactions?.length > 0)
                        };
                    } catch (error) {
                        console.warn(`Failed to fetch data for ${chain}:`, error);
                        return {
                            chain,
                            networkName: this.getNetworkName(chain),
                            nfts: [],
                            tokens: [],
                            transactions: [],
                            active: false,
                            error: error.message
                        };
                    }
                })
            );

            return profiles
                .filter(result => result.status === 'fulfilled')
                .map(result => result.value)
                .filter(profile => profile.active);
        } catch (error) {
            console.error('Error fetching wallet profile:', error);
            throw error;
        }
    }

    // Data transformation methods
    transformNFTResponse(data, chain) {
        if (!data || !Array.isArray(data)) return [];
        
        return data.map(nft => ({
            processed: true,
            network: chain,
            networkName: this.getNetworkName(chain),
            name: nft.name || 'Unknown NFT',
            description: nft.description || '',
            image_small_url: nft.image_url || nft.image,
            contract_address: nft.contract_address,
            token_id: nft.token_id,
            owner: nft.owner_address,
            collection_name: nft.collection_name,
            attributes: nft.attributes || []
        }));
    }

    transformNFTMetadata(data, chain) {
        if (!data) return null;

        return {
            processed: true,
            network: chain,
            networkName: this.getNetworkName(chain),
            name: data.name,
            description: data.description,
            image_url: data.image_url || data.image,
            contract_address: data.contract_address,
            token_id: data.token_id,
            attributes: data.attributes || [],
            collection: data.collection || {}
        };
    }

    transformCollectionData(data, chain) {
        if (!data) return null;

        return {
            processed: true,
            network: chain,
            networkName: this.getNetworkName(chain),
            name: data.name,
            description: data.description,
            image_url: data.image_url,
            contract_address: data.contract_address,
            total_supply: data.total_supply,
            owner_count: data.owner_count,
            floor_price: data.floor_price,
            volume: data.volume
        };
    }

    transformTokenBalances(data, chain) {
        if (!data || !Array.isArray(data)) return [];

        return data.map(token => ({
            network: chain,
            networkName: this.getNetworkName(chain),
            token_address: token.contract_address,
            symbol: token.symbol,
            name: token.name,
            balance: token.balance,
            decimals: token.decimals,
            usd_value: token.usd_value,
            price: token.price
        }));
    }

    transformTransactionHistory(data, chain) {
        if (!data || !Array.isArray(data)) return [];

        return data.map(tx => ({
            network: chain,
            networkName: this.getNetworkName(chain),
            hash: tx.transaction_hash,
            from: tx.from_address,
            to: tx.to_address,
            value: tx.value,
            timestamp: tx.timestamp,
            block_number: tx.block_number,
            gas_used: tx.gas_used,
            gas_price: tx.gas_price,
            type: tx.transaction_type
        }));
    }

    // Custom SQL queries (Allium's specialty)
    async executeCustomQuery(sqlQuery) {
        try {
            const data = await this.makeRequest('/sql', {
                query: sqlQuery
            });

            return data;
        } catch (error) {
            console.error('Error executing custom SQL query:', error);
            throw error;
        }
    }

    // Wallet analytics (Allium's Wallet360 features)
    async getWalletAnalytics(walletAddress) {
        try {
            const data = await this.makeRequest('/wallet/analytics', {
                address: walletAddress
            });

            return {
                address: walletAddress,
                age_days: data.age_days,
                transaction_count: data.transaction_count,
                active_days: data.active_days,
                first_transaction: data.first_transaction,
                last_transaction: data.last_transaction,
                total_volume_usd: data.total_volume_usd,
                nft_collections_held: data.nft_collections_held,
                defi_protocols_used: data.defi_protocols_used,
                risk_score: data.risk_score
            };
        } catch (error) {
            console.error('Error fetching wallet analytics:', error);
            throw error;
        }
    }
} 