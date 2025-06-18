export class ReservoirMultichainClient {
    constructor() {
        this.networkMapping = {
            "ethereum": "Ethereum",
            "polygon": "Polygon",
            "arbitrum": "Arbitrum",
            "optimism": "Optimism",
            "base": "Base",
            "zora": "Zora",
            "avalanche": "Avalanche",
            "bsc": "BSC",
            "linea": "Linea",
            "scroll": "Scroll"
        };
        
        this.api_key = process.env.NEXT_PUBLIC_RESERVOIR_API_KEY;
        
        // Reservoir API endpoints by chain
        this.base_urls = {
            ethereum: "https://api.reservoir.tools",
            polygon: "https://api-polygon.reservoir.tools",
            arbitrum: "https://api-arbitrum.reservoir.tools",
            optimism: "https://api-optimism.reservoir.tools",
            base: "https://api-base.reservoir.tools",
            zora: "https://api-zora.reservoir.tools",
            avalanche: "https://api-avalanche.reservoir.tools",
            bsc: "https://api-bsc.reservoir.tools",
            linea: "https://api-linea.reservoir.tools",
            scroll: "https://api-scroll.reservoir.tools"
        };
    }

    getChains() {
        return Object.keys(this.networkMapping);
    }

    getNetworkName(networkId) {
        return this.networkMapping[networkId] || networkId;
    }

    getBaseUrl(chain = 'ethereum') {
        return this.base_urls[chain] || this.base_urls.ethereum;
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
            console.error('Reservoir API fetch failed:', error);
            throw error;
        }
    }

    async makeRequest(endpoint, params = {}, chain = 'ethereum') {
        const baseUrl = this.getBaseUrl(chain);
        const url = new URL(`${baseUrl}${endpoint}`);
        
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null) {
                url.searchParams.append(key, params[key]);
            }
        });

        const options = {
            method: 'GET',
            headers: {
                'accept': 'application/json',
                'x-api-key': this.api_key
            }
        };

        return await this.fetchWithBackoff(url.toString(), options);
    }

    // Collection Methods
    async getCollections(params = {}, chain = 'ethereum') {
        try {
            const data = await this.makeRequest('/collections/v7', {
                limit: 20,
                sortBy: 'allTimeVolume',
                ...params
            }, chain);

            return this.transformCollectionsResponse(data.collections, chain);
        } catch (error) {
            console.error('Error fetching collections:', error);
            throw error;
        }
    }

    async getCollectionById(collectionId, chain = 'ethereum') {
        try {
            const data = await this.makeRequest(`/collections/v7`, {
                id: collectionId
            }, chain);

            return this.transformCollectionData(data.collections?.[0], chain);
        } catch (error) {
            console.error('Error fetching collection by ID:', error);
            throw error;
        }
    }

    async getCollectionActivity(collectionId, params = {}, chain = 'ethereum') {
        try {
            const data = await this.makeRequest('/collections/activity/v6', {
                collection: collectionId,
                limit: 50,
                ...params
            }, chain);

            return this.transformActivityResponse(data.activities, chain);
        } catch (error) {
            console.error('Error fetching collection activity:', error);
            throw error;
        }
    }

    async getCollectionFloorAsk(collectionId, chain = 'ethereum') {
        try {
            const data = await this.makeRequest('/collections/floor-ask/v4', {
                collection: collectionId
            }, chain);

            return data;
        } catch (error) {
            console.error('Error fetching collection floor ask:', error);
            throw error;
        }
    }

    // Token Methods
    async getTokensByOwner(owner, params = {}, chain = 'ethereum') {
        try {
            const data = await this.makeRequest('/users/tokens/v7', {
                user: owner,
                limit: 50,
                includeTopBid: true,
                includeAttributes: true,
                ...params
            }, chain);

            return this.transformTokensResponse(data.tokens, chain);
        } catch (error) {
            console.error('Error fetching tokens by owner:', error);
            throw error;
        }
    }

    async getTokenDetails(contract, tokenId, chain = 'ethereum') {
        try {
            const data = await this.makeRequest('/tokens/v7', {
                tokens: `${contract}:${tokenId}`,
                includeTopBid: true,
                includeAttributes: true,
                includeLastSale: true
            }, chain);

            return this.transformTokenData(data.tokens?.[0], chain);
        } catch (error) {
            console.error('Error fetching token details:', error);
            throw error;
        }
    }

    async getTokenActivity(contract, tokenId, params = {}, chain = 'ethereum') {
        try {
            const data = await this.makeRequest('/tokens/activity/v6', {
                token: `${contract}:${tokenId}`,
                limit: 50,
                ...params
            }, chain);

            return this.transformActivityResponse(data.activities, chain);
        } catch (error) {
            console.error('Error fetching token activity:', error);
            throw error;
        }
    }

    // Market Data Methods
    async getOrders(params = {}, chain = 'ethereum') {
        try {
            const data = await this.makeRequest('/orders/asks/v5', {
                limit: 50,
                sortBy: 'price',
                ...params
            }, chain);

            return this.transformOrdersResponse(data.orders, chain);
        } catch (error) {
            console.error('Error fetching orders:', error);
            throw error;
        }
    }

    async getBids(params = {}, chain = 'ethereum') {
        try {
            const data = await this.makeRequest('/orders/bids/v6', {
                limit: 50,
                sortBy: 'price',
                sortDirection: 'desc',
                ...params
            }, chain);

            return this.transformBidsResponse(data.orders, chain);
        } catch (error) {
            console.error('Error fetching bids:', error);
            throw error;
        }
    }

    async getSales(params = {}, chain = 'ethereum') {
        try {
            const data = await this.makeRequest('/sales/v6', {
                limit: 50,
                ...params
            }, chain);

            return this.transformSalesResponse(data.sales, chain);
        } catch (error) {
            console.error('Error fetching sales:', error);
            throw error;
        }
    }

    // Analytics Methods
    async getCollectionStats(collectionId, chain = 'ethereum') {
        try {
            const data = await this.makeRequest('/collections/stats/v2', {
                collection: collectionId
            }, chain);

            return this.transformStatsResponse(data.stats, chain);
        } catch (error) {
            console.error('Error fetching collection stats:', error);
            throw error;
        }
    }

    async getMarketplaceStats(marketplace, chain = 'ethereum') {
        try {
            const data = await this.makeRequest('/stats/v2', {
                marketplace: marketplace
            }, chain);

            return data;
        } catch (error) {
            console.error('Error fetching marketplace stats:', error);
            throw error;
        }
    }

    // Cross-chain Methods
    async getWalletProfile(walletAddress) {
        try {
            const chains = this.getChains();
            const profiles = await Promise.allSettled(
                chains.map(async (chain) => {
                    try {
                        const [tokens, activity] = await Promise.all([
                            this.getTokensByOwner(walletAddress, { limit: 20 }, chain),
                            this.getUserActivity(walletAddress, { limit: 10 }, chain)
                        ]);

                        return {
                            chain,
                            networkName: this.getNetworkName(chain),
                            tokens: tokens || [],
                            activity: activity || [],
                            active: (tokens?.length > 0) || (activity?.length > 0)
                        };
                    } catch (error) {
                        console.warn(`Failed to fetch data for ${chain}:`, error);
                        return {
                            chain,
                            networkName: this.getNetworkName(chain),
                            tokens: [],
                            activity: [],
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

    async getUserActivity(user, params = {}, chain = 'ethereum') {
        try {
            const data = await this.makeRequest('/users/activity/v6', {
                users: user,
                limit: 20,
                ...params
            }, chain);

            return this.transformActivityResponse(data.activities, chain);
        } catch (error) {
            console.error('Error fetching user activity:', error);
            throw error;
        }
    }

    // Search Methods
    async searchCollections(query, chain = 'ethereum') {
        try {
            const data = await this.makeRequest('/search/collections/v2', {
                name: query,
                limit: 20
            }, chain);

            return this.transformCollectionsResponse(data.collections, chain);
        } catch (error) {
            console.error('Error searching collections:', error);
            throw error;
        }
    }

    // Data Transformation Methods
    transformCollectionsResponse(collections, chain) {
        if (!collections || !Array.isArray(collections)) return [];
        
        return collections.map(collection => ({
            processed: true,
            network: chain,
            networkName: this.getNetworkName(chain),
            name: collection.name,
            description: collection.description || `${collection.name} collection with ${collection.tokenCount} tokens`,
            image_small_url: collection.image,
            contract_address: collection.id,
            distinct_owner_count: collection.ownerCount,
            total_supply: collection.tokenCount,
            floor_price: collection.floorAsk?.price?.amount?.native,
            floor_price_usd: collection.floorAsk?.price?.amount?.usd,
            volume_1day: collection.volume?.['1day'],
            volume_7day: collection.volume?.['7day'],
            volume_30day: collection.volume?.['30day'],
            volume_all_time: collection.volume?.allTime,
            sales_count: collection.salesCount,
            created_at: collection.createdAt,
            large_collection: (collection.tokenCount > 50000) || false
        }));
    }

    transformCollectionData(collection, chain) {
        if (!collection) return null;

        return {
            processed: true,
            network: chain,
            networkName: this.getNetworkName(chain),
            name: collection.name,
            description: collection.description,
            image_url: collection.image,
            contract_address: collection.id,
            symbol: collection.symbol,
            total_supply: collection.tokenCount,
            distinct_owner_count: collection.ownerCount,
            floor_price: collection.floorAsk?.price?.amount?.native,
            floor_price_usd: collection.floorAsk?.price?.amount?.usd,
            top_bid: collection.topBid?.price?.amount?.native,
            top_bid_usd: collection.topBid?.price?.amount?.usd,
            volume: collection.volume,
            sales_count: collection.salesCount,
            royalties: collection.royalties,
            marketplace_fees: collection.marketplaceFees,
            created_at: collection.createdAt
        };
    }

    transformTokensResponse(tokens, chain) {
        if (!tokens || !Array.isArray(tokens)) return [];
        
        return tokens.map(token => ({
            processed: true,
            network: chain,
            networkName: this.getNetworkName(chain),
            name: token.token?.name || `${token.token?.collection?.name} #${token.token?.tokenId}`,
            description: token.token?.description || '',
            image_small_url: token.token?.image,
            contract_address: token.token?.contract,
            token_id: token.token?.tokenId,
            owner: token.ownership?.tokenCount > 0 ? 'owned' : 'not owned',
            collection_name: token.token?.collection?.name,
            attributes: token.token?.attributes || [],
            rarity_score: token.token?.rarityScore,
            rarity_rank: token.token?.rarityRank,
            floor_ask_price: token.market?.floorAsk?.price?.amount?.native,
            floor_ask_price_usd: token.market?.floorAsk?.price?.amount?.usd,
            top_bid_price: token.market?.topBid?.price?.amount?.native,
            top_bid_price_usd: token.market?.topBid?.price?.amount?.usd,
            last_sale: token.token?.lastSale
        }));
    }

    transformTokenData(token, chain) {
        if (!token) return null;

        return {
            processed: true,
            network: chain,
            networkName: this.getNetworkName(chain),
            name: token.token?.name,
            description: token.token?.description,
            image_url: token.token?.image,
            contract_address: token.token?.contract,
            token_id: token.token?.tokenId,
            collection: token.token?.collection,
            attributes: token.token?.attributes || [],
            rarity_score: token.token?.rarityScore,
            rarity_rank: token.token?.rarityRank,
            owner: token.token?.owner,
            floor_ask: token.market?.floorAsk,
            top_bid: token.market?.topBid,
            last_sale: token.token?.lastSale,
            transfer_history: token.token?.transfers
        };
    }

    transformActivityResponse(activities, chain) {
        if (!activities || !Array.isArray(activities)) return [];
        
        return activities.map(activity => ({
            network: chain,
            networkName: this.getNetworkName(chain),
            type: activity.type,
            from_address: activity.fromAddress,
            to_address: activity.toAddress,
            price: activity.price?.amount?.native,
            price_usd: activity.price?.amount?.usd,
            token: {
                contract: activity.token?.contract,
                token_id: activity.token?.tokenId,
                name: activity.token?.name,
                image: activity.token?.image
            },
            collection: activity.collection,
            transaction_hash: activity.txHash,
            block_number: activity.blockNumber,
            timestamp: activity.timestamp,
            marketplace: activity.order?.source?.name
        }));
    }

    transformOrdersResponse(orders, chain) {
        if (!orders || !Array.isArray(orders)) return [];
        
        return orders.map(order => ({
            network: chain,
            networkName: this.getNetworkName(chain),
            id: order.id,
            kind: order.kind,
            side: order.side,
            status: order.status,
            token_set_id: order.tokenSetId,
            contract: order.contract,
            maker: order.maker,
            taker: order.taker,
            price: order.price?.amount?.native,
            price_usd: order.price?.amount?.usd,
            valid_from: order.validFrom,
            valid_until: order.validUntil,
            source: order.source,
            fee_breakdown: order.feeBreakdown,
            criteria: order.criteria,
            raw_data: order.rawData
        }));
    }

    transformBidsResponse(bids, chain) {
        return this.transformOrdersResponse(bids, chain);
    }

    transformSalesResponse(sales, chain) {
        if (!sales || !Array.isArray(sales)) return [];
        
        return sales.map(sale => ({
            network: chain,
            networkName: this.getNetworkName(chain),
            id: sale.id,
            saleId: sale.saleId,
            token: sale.token,
            orderId: sale.orderId,
            orderSource: sale.orderSource,
            orderSide: sale.orderSide,
            orderKind: sale.orderKind,
            from: sale.from,
            to: sale.to,
            amount: sale.amount,
            fillSource: sale.fillSource,
            block: sale.block,
            txHash: sale.txHash,
            logIndex: sale.logIndex,
            batchIndex: sale.batchIndex,
            timestamp: sale.timestamp,
            price: sale.price,
            washTradingScore: sale.washTradingScore,
            marketplaceFeeBps: sale.marketplaceFeeBps,
            royaltyFeeBps: sale.royaltyFeeBps,
            paidFullRoyalty: sale.paidFullRoyalty,
            feeBreakdown: sale.feeBreakdown
        }));
    }

    transformStatsResponse(stats, chain) {
        if (!stats) return null;

        return {
            network: chain,
            networkName: this.getNetworkName(chain),
            token_count: stats.tokenCount,
            owner_count: stats.ownerCount,
            floor_price: stats.market?.floorAsk?.price?.amount?.native,
            floor_price_usd: stats.market?.floorAsk?.price?.amount?.usd,
            top_bid: stats.market?.topBid?.price?.amount?.native,
            top_bid_usd: stats.market?.topBid?.price?.amount?.usd,
            volume_1day: stats.volume?.['1day'],
            volume_7day: stats.volume?.['7day'],
            volume_30day: stats.volume?.['30day'],
            volume_all_time: stats.volume?.allTime,
            sales_count: stats.salesCount,
            average_sale_price: stats.volume?.allTime && stats.salesCount ? 
                (stats.volume.allTime / stats.salesCount) : null
        };
    }

    // Trading Methods (requires additional setup for wallet integration)
    async createBuyOrder(tokenContract, tokenId, price, chain = 'ethereum') {
        // This would require wallet integration and signing
        // Implementation depends on your wallet setup (MetaMask, WalletConnect, etc.)
        console.log('Buy order creation requires wallet integration');
        throw new Error('Buy order creation requires wallet integration - implement based on your wallet setup');
    }

    async createSellOrder(tokenContract, tokenId, price, chain = 'ethereum') {
        // This would require wallet integration and signing
        // Implementation depends on your wallet setup
        console.log('Sell order creation requires wallet integration');
        throw new Error('Sell order creation requires wallet integration - implement based on your wallet setup');
    }
} 