export class HeliusMultichainClient {
    constructor() {
        this.networkMapping = {
            "solana": "Solana",
            "solana-mainnet": "Solana Mainnet",
            "solana-devnet": "Solana Devnet"
        };
        
        this.api_key = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
        this.base_url = "https://api.helius.xyz/v0";
        this.rpc_url = `https://rpc.helius.xyz/?api-key=${this.api_key}`;
        
        // Helius is primarily focused on Solana
        this.defaultChain = "solana";
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
            console.error('Helius API fetch failed:', error);
            throw error;
        }
    }

    async makeRequest(endpoint, params = {}, method = 'GET') {
        const url = new URL(`${this.base_url}${endpoint}`);
        url.searchParams.append('api-key', this.api_key);
        
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (method === 'POST') {
            options.body = JSON.stringify(params);
        } else {
            Object.keys(params).forEach(key => {
                if (params[key] !== undefined && params[key] !== null) {
                    url.searchParams.append(key, params[key]);
                }
            });
        }

        return await this.fetchWithBackoff(url.toString(), options);
    }

    async makeRPCRequest(method, params = []) {
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method,
                params
            })
        };

        const response = await this.fetchWithBackoff(this.rpc_url, options);
        
        if (response.error) {
            throw new Error(`RPC Error: ${response.error.message}`);
        }
        
        return response.result;
    }

    // NFT Methods
    async getNFTsByOwner(ownerAddress, params = {}) {
        try {
            const data = await this.makeRequest('/addresses/nfts', {
                owners: [ownerAddress],
                limit: 1000,
                ...params
            }, 'POST');

            return this.transformNFTResponse(data.result || data, 'solana');
        } catch (error) {
            console.error('Error fetching NFTs by owner:', error);
            throw error;
        }
    }

    async getNFTMetadata(mintAddresses) {
        try {
            const addresses = Array.isArray(mintAddresses) ? mintAddresses : [mintAddresses];
            
            const data = await this.makeRequest('/tokens/metadata', {
                mints: addresses
            }, 'POST');

            return this.transformNFTMetadata(data, 'solana');
        } catch (error) {
            console.error('Error fetching NFT metadata:', error);
            throw error;
        }
    }

    async getNFTEvents(accounts, types = [], params = {}) {
        try {
            const data = await this.makeRequest('/nft-events', {
                accounts,
                types,
                limit: 100,
                ...params
            }, 'POST');

            return this.transformNFTEvents(data.result || data, 'solana');
        } catch (error) {
            console.error('Error fetching NFT events:', error);
            throw error;
        }
    }

    // Collection Methods
    async getCollectionNFTs(collectionId, params = {}) {
        try {
            const data = await this.makeRequest('/nfts', {
                collection: collectionId,
                limit: 1000,
                ...params
            }, 'POST');

            return this.transformCollectionNFTs(data.result || data, 'solana');
        } catch (error) {
            console.error('Error fetching collection NFTs:', error);
            throw error;
        }
    }

    async getCollectionFloorPrice(collectionId) {
        try {
            const data = await this.makeRequest(`/collections/${collectionId}/floor-price`);
            return {
                collection_id: collectionId,
                floor_price_lamports: data.floorPrice,
                floor_price_sol: data.floorPrice / 1000000000, // Convert lamports to SOL
                marketplace: data.marketplace,
                updated_at: data.updatedAt
            };
        } catch (error) {
            console.error('Error fetching collection floor price:', error);
            throw error;
        }
    }

    // Transaction Methods
    async getTransactionHistory(address, params = {}) {
        try {
            const data = await this.makeRequest('/addresses/transactions', {
                address,
                limit: 100,
                ...params
            }, 'POST');

            return this.transformTransactionHistory(data.result || data, 'solana');
        } catch (error) {
            console.error('Error fetching transaction history:', error);
            throw error;
        }
    }

    async getTransactionDetails(signature) {
        try {
            const data = await this.makeRPCRequest('getTransaction', [
                signature,
                { 
                    encoding: 'jsonParsed',
                    maxSupportedTransactionVersion: 0
                }
            ]);

            return this.transformTransactionDetails(data, 'solana');
        } catch (error) {
            console.error('Error fetching transaction details:', error);
            throw error;
        }
    }

    // DeFi and Token Methods
    async getTokenBalances(address) {
        try {
            const data = await this.makeRequest('/addresses/balances', {
                addresses: [address]
            }, 'POST');

            return this.transformTokenBalances(data.result || data, 'solana');
        } catch (error) {
            console.error('Error fetching token balances:', error);
            throw error;
        }
    }

    async getTokenMetadata(mintAddresses) {
        try {
            const addresses = Array.isArray(mintAddresses) ? mintAddresses : [mintAddresses];
            
            const data = await this.makeRequest('/tokens/metadata', {
                mints: addresses
            }, 'POST');

            return data;
        } catch (error) {
            console.error('Error fetching token metadata:', error);
            throw error;
        }
    }

    // Webhook and Real-time Methods
    async createWebhook(webhookURL, accountAddresses, transactionTypes = []) {
        try {
            const data = await this.makeRequest('/webhooks', {
                webhookURL,
                accountAddresses,
                transactionTypes,
                webhookType: 'enhanced'
            }, 'POST');

            return data;
        } catch (error) {
            console.error('Error creating webhook:', error);
            throw error;
        }
    }

    async getWebhooks() {
        try {
            const data = await this.makeRequest('/webhooks');
            return data;
        } catch (error) {
            console.error('Error fetching webhooks:', error);
            throw error;
        }
    }

    async deleteWebhook(webhookID) {
        try {
            const data = await this.makeRequest(`/webhooks/${webhookID}`, {}, 'DELETE');
            return data;
        } catch (error) {
            console.error('Error deleting webhook:', error);
            throw error;
        }
    }

    // Analytics Methods
    async getWalletAnalytics(address) {
        try {
            const [nfts, transactions, balances] = await Promise.all([
                this.getNFTsByOwner(address),
                this.getTransactionHistory(address, { limit: 50 }),
                this.getTokenBalances(address)
            ]);

            return this.calculateWalletAnalytics(address, nfts, transactions, balances);
        } catch (error) {
            console.error('Error fetching wallet analytics:', error);
            throw error;
        }
    }

    async getNFTActivity(mintAddress, params = {}) {
        try {
            const data = await this.makeRequest('/nft-events', {
                accounts: [mintAddress],
                limit: 100,
                ...params
            }, 'POST');

            return this.transformNFTEvents(data.result || data, 'solana');
        } catch (error) {
            console.error('Error fetching NFT activity:', error);
            throw error;
        }
    }

    // Data Transformation Methods
    transformNFTResponse(nfts, chain) {
        if (!nfts || !Array.isArray(nfts)) return [];
        
        return nfts.map(nft => ({
            processed: true,
            network: chain,
            networkName: this.getNetworkName(chain),
            name: nft.content?.metadata?.name || 'Unknown NFT',
            description: nft.content?.metadata?.description || '',
            image_small_url: nft.content?.files?.[0]?.uri || nft.content?.metadata?.image,
            mint_address: nft.id,
            owner: nft.ownership?.owner,
            collection_name: nft.grouping?.find(g => g.group_key === 'collection')?.group_value,
            collection_address: nft.grouping?.find(g => g.group_key === 'collection')?.group_value,
            attributes: nft.content?.metadata?.attributes || [],
            creators: nft.creators || [],
            royalty: nft.royalty,
            burnt: nft.burnt,
            lamports: nft.lamports,
            executable: nft.executable,
            frozen: nft.frozen
        }));
    }

    transformNFTMetadata(metadata, chain) {
        if (!metadata || !Array.isArray(metadata)) return [];
        
        return metadata.map(nft => ({
            network: chain,
            networkName: this.getNetworkName(chain),
            mint_address: nft.account,
            name: nft.onChainMetadata?.metadata?.data?.name,
            symbol: nft.onChainMetadata?.metadata?.data?.symbol,
            uri: nft.onChainMetadata?.metadata?.data?.uri,
            creators: nft.onChainMetadata?.metadata?.data?.creators || [],
            seller_fee_basis_points: nft.onChainMetadata?.metadata?.data?.sellerFeeBasisPoints,
            off_chain_metadata: nft.offChainMetadata || {}
        }));
    }

    transformNFTEvents(events, chain) {
        if (!events || !Array.isArray(events)) return [];
        
        return events.map(event => ({
            network: chain,
            networkName: this.getNetworkName(chain),
            signature: event.signature,
            type: event.type,
            source: event.source,
            timestamp: event.timestamp,
            slot: event.slot,
            native_transfers: event.nativeTransfers || [],
            token_transfers: event.tokenTransfers || [],
            account_data: event.accountData || [],
            instruction: event.instruction || {},
            events: event.events || {}
        }));
    }

    transformCollectionNFTs(nfts, chain) {
        return this.transformNFTResponse(nfts, chain);
    }

    transformTransactionHistory(transactions, chain) {
        if (!transactions || !Array.isArray(transactions)) return [];
        
        return transactions.map(tx => ({
            network: chain,
            networkName: this.getNetworkName(chain),
            signature: tx.signature,
            timestamp: tx.timestamp,
            slot: tx.slot,
            type: tx.type,
            source: tx.source,
            fee: tx.fee,
            fee_payer: tx.feePayer,
            native_transfers: tx.nativeTransfers || [],
            token_transfers: tx.tokenTransfers || [],
            account_data: tx.accountData || [],
            instruction: tx.instruction || {},
            events: tx.events || {}
        }));
    }

    transformTransactionDetails(transaction, chain) {
        if (!transaction) return null;

        return {
            network: chain,
            networkName: this.getNetworkName(chain),
            signature: transaction.transaction?.signatures?.[0],
            slot: transaction.slot,
            block_time: transaction.blockTime,
            meta: transaction.meta,
            transaction: transaction.transaction,
            version: transaction.version
        };
    }

    transformTokenBalances(balances, chain) {
        if (!balances || !Array.isArray(balances)) return [];
        
        return balances.flatMap(addressData => 
            addressData.tokens?.map(token => ({
                network: chain,
                networkName: this.getNetworkName(chain),
                address: addressData.address,
                mint: token.mint,
                amount: token.amount,
                decimals: token.decimals,
                token_account: token.tokenAccount
            })) || []
        );
    }

    calculateWalletAnalytics(address, nfts, transactions, balances) {
        const nftCollections = new Set();
        nfts.forEach(nft => {
            if (nft.collection_address) {
                nftCollections.add(nft.collection_address);
            }
        });

        const transactionTypes = {};
        transactions.forEach(tx => {
            transactionTypes[tx.type] = (transactionTypes[tx.type] || 0) + 1;
        });

        const totalTokens = balances.length;
        const totalNFTs = nfts.length;

        return {
            network: 'solana',
            networkName: this.getNetworkName('solana'),
            wallet_address: address,
            total_nfts: totalNFTs,
            unique_collections: nftCollections.size,
            total_tokens: totalTokens,
            total_transactions: transactions.length,
            transaction_types: transactionTypes,
            first_transaction: transactions.length > 0 ? 
                Math.min(...transactions.map(tx => tx.timestamp)) : null,
            last_transaction: transactions.length > 0 ? 
                Math.max(...transactions.map(tx => tx.timestamp)) : null,
            collections: Array.from(nftCollections),
            active_tokens: balances.filter(token => parseFloat(token.amount) > 0)
        };
    }

    // Utility Methods
    async getAccountInfo(address) {
        try {
            const data = await this.makeRPCRequest('getAccountInfo', [
                address,
                { encoding: 'jsonParsed' }
            ]);

            return data;
        } catch (error) {
            console.error('Error fetching account info:', error);
            throw error;
        }
    }

    async getMultipleAccountInfo(addresses) {
        try {
            const data = await this.makeRPCRequest('getMultipleAccounts', [
                addresses,
                { encoding: 'jsonParsed' }
            ]);

            return data;
        } catch (error) {
            console.error('Error fetching multiple account info:', error);
            throw error;
        }
    }

    // Name Service Methods
    async resolveDomain(domain) {
        try {
            // This would integrate with Solana Name Service or other domain services
            const data = await this.makeRequest('/domains/resolve', {
                domain
            }, 'POST');

            return data;
        } catch (error) {
            console.error('Error resolving domain:', error);
            throw error;
        }
    }

    async reverseLookup(address) {
        try {
            const data = await this.makeRequest('/domains/reverse', {
                address
            }, 'POST');

            return data;
        } catch (error) {
            console.error('Error performing reverse lookup:', error);
            throw error;
        }
    }

    // Marketplace Integration Methods
    async getMagicEdenListings(collectionSymbol) {
        try {
            // Integration with Magic Eden API through Helius
            const data = await this.makeRequest('/marketplace/magic-eden/listings', {
                collection: collectionSymbol,
                limit: 100
            });

            return data;
        } catch (error) {
            console.error('Error fetching Magic Eden listings:', error);
            throw error;
        }
    }

    async getMarketplaceActivity(marketplace, params = {}) {
        try {
            const data = await this.makeRequest(`/marketplace/${marketplace}/activity`, {
                limit: 100,
                ...params
            });

            return data;
        } catch (error) {
            console.error('Error fetching marketplace activity:', error);
            throw error;
        }
    }
} 