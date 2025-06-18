export class GoldskyMultichainClient {
    constructor() {
        this.networkMapping = {
            "ethereum": "Ethereum",
            "polygon": "Polygon",
            "arbitrum": "Arbitrum", 
            "optimism": "Optimism",
            "base": "Base",
            "avalanche": "Avalanche",
            "bsc": "BSC",
            "gnosis": "Gnosis",
            "fantom": "Fantom",
            "celo": "Celo"
        };
        this.api_key = process.env.NEXT_PUBLIC_GOLDSKY_API_KEY;
        this.base_url = "https://api.goldsky.com/api/public";
        this.subgraph_url = "https://api.goldsky.com/api/public/project_";
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
            console.error('Goldsky API fetch failed:', error);
            throw error;
        }
    }

    async makeGraphQLRequest(query, variables = {}, subgraphId = null) {
        const url = subgraphId 
            ? `${this.subgraph_url}${subgraphId}/subgraphs/nft-subgraph/gn`
            : `${this.base_url}/graphql`;
            
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.api_key}`
            },
            body: JSON.stringify({
                query,
                variables
            })
        };

        const response = await this.fetchWithBackoff(url, options);
        
        if (response.errors) {
            throw new Error(`GraphQL errors: ${JSON.stringify(response.errors)}`);
        }
        
        return response.data;
    }

    async makeRESTRequest(endpoint, params = {}) {
        const url = new URL(`${this.base_url}${endpoint}`);
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined) {
                url.searchParams.append(key, params[key]);
            }
        });

        const options = {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.api_key}`,
                'Content-Type': 'application/json'
            }
        };

        return await this.fetchWithBackoff(url.toString(), options);
    }

    // NFT Methods using GraphQL
    async getNFTsByOwner(walletAddress, chain = 'ethereum', limit = 100) {
        const query = `
            query GetNFTsByOwner($owner: String!, $first: Int!) {
                tokens(
                    where: { owner: $owner }
                    first: $first
                    orderBy: blockNumber
                    orderDirection: desc
                ) {
                    id
                    tokenId
                    owner
                    contract {
                        id
                        name
                        symbol
                        totalSupply
                    }
                    tokenURI
                    metadata {
                        name
                        description
                        image
                        attributes {
                            trait_type
                            value
                        }
                    }
                    transfers(first: 1, orderBy: blockNumber, orderDirection: desc) {
                        id
                        from
                        to
                        blockNumber
                        timestamp
                        transactionHash
                    }
                }
            }
        `;

        try {
            const data = await this.makeGraphQLRequest(query, {
                owner: walletAddress.toLowerCase(),
                first: limit
            });

            return this.transformNFTResponse(data.tokens, chain);
        } catch (error) {
            console.error('Error fetching NFTs by owner:', error);
            throw error;
        }
    }

    async getNFTCollectionData(contractAddress, chain = 'ethereum') {
        const query = `
            query GetCollectionData($contract: String!) {
                contract(id: $contract) {
                    id
                    name
                    symbol
                    totalSupply
                    tokens(first: 1000) {
                        id
                        owner
                        metadata {
                            name
                            description
                            image
                        }
                    }
                    transfers(first: 100, orderBy: blockNumber, orderDirection: desc) {
                        id
                        from
                        to
                        tokenId
                        blockNumber
                        timestamp
                        transactionHash
                    }
                }
            }
        `;

        try {
            const data = await this.makeGraphQLRequest(query, {
                contract: contractAddress.toLowerCase()
            });

            return this.transformCollectionData(data.contract, chain);
        } catch (error) {
            console.error('Error fetching collection data:', error);
            throw error;
        }
    }

    async getNFTTransfers(contractAddress, tokenId = null, chain = 'ethereum', limit = 100) {
        const query = tokenId ? `
            query GetNFTTransfers($contract: String!, $tokenId: String!, $first: Int!) {
                transfers(
                    where: { 
                        contract: $contract,
                        tokenId: $tokenId
                    }
                    first: $first
                    orderBy: blockNumber
                    orderDirection: desc
                ) {
                    id
                    from
                    to
                    tokenId
                    contract {
                        id
                        name
                        symbol
                    }
                    blockNumber
                    timestamp
                    transactionHash
                    gasUsed
                    gasPrice
                }
            }
        ` : `
            query GetCollectionTransfers($contract: String!, $first: Int!) {
                transfers(
                    where: { contract: $contract }
                    first: $first
                    orderBy: blockNumber
                    orderDirection: desc
                ) {
                    id
                    from
                    to
                    tokenId
                    contract {
                        id
                        name
                        symbol
                    }
                    blockNumber
                    timestamp
                    transactionHash
                    gasUsed
                    gasPrice
                }
            }
        `;

        try {
            const variables = tokenId 
                ? { contract: contractAddress.toLowerCase(), tokenId, first: limit }
                : { contract: contractAddress.toLowerCase(), first: limit };

            const data = await this.makeGraphQLRequest(query, variables);
            return this.transformTransferData(data.transfers, chain);
        } catch (error) {
            console.error('Error fetching NFT transfers:', error);
            throw error;
        }
    }

    // Real-time data streaming methods
    async subscribeToNFTTransfers(contractAddress, callback, chain = 'ethereum') {
        // WebSocket subscription for real-time NFT transfers
        const wsUrl = `wss://api.goldsky.com/ws/project_${this.api_key}/subgraphs/nft-subgraph`;
        
        try {
            const ws = new WebSocket(wsUrl);
            
            ws.onopen = () => {
                const subscription = {
                    id: '1',
                    type: 'start',
                    payload: {
                        query: `
                            subscription {
                                transfers(
                                    where: { contract: "${contractAddress.toLowerCase()}" }
                                    orderBy: blockNumber
                                    orderDirection: desc
                                ) {
                                    id
                                    from
                                    to
                                    tokenId
                                    blockNumber
                                    timestamp
                                    transactionHash
                                }
                            }
                        `
                    }
                };
                ws.send(JSON.stringify(subscription));
            };

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'data' && data.payload.data.transfers) {
                    const transformedData = this.transformTransferData(data.payload.data.transfers, chain);
                    callback(transformedData);
                }
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

            return ws; // Return WebSocket instance for manual closing
        } catch (error) {
            console.error('Error setting up NFT transfer subscription:', error);
            throw error;
        }
    }

    // Analytics and insights
    async getCollectionAnalytics(contractAddress, chain = 'ethereum', timeframe = '7d') {
        const query = `
            query GetCollectionAnalytics($contract: String!, $timestamp: Int!) {
                contract(id: $contract) {
                    id
                    name
                    symbol
                    totalSupply
                    transfers(
                        where: { timestamp_gte: $timestamp }
                        orderBy: timestamp
                        orderDirection: desc
                    ) {
                        id
                        from
                        to
                        tokenId
                        timestamp
                        transactionHash
                    }
                }
            }
        `;

        try {
            const timestampCutoff = Math.floor(Date.now() / 1000) - this.getTimeframeSeconds(timeframe);
            
            const data = await this.makeGraphQLRequest(query, {
                contract: contractAddress.toLowerCase(),
                timestamp: timestampCutoff
            });

            return this.calculateAnalytics(data.contract, timeframe, chain);
        } catch (error) {
            console.error('Error fetching collection analytics:', error);
            throw error;
        }
    }

    async getWalletAnalytics(walletAddress, chain = 'ethereum', timeframe = '30d') {
        const query = `
            query GetWalletAnalytics($wallet: String!, $timestamp: Int!) {
                transfers(
                    where: { 
                        or: [
                            { from: $wallet },
                            { to: $wallet }
                        ],
                        timestamp_gte: $timestamp
                    }
                    orderBy: timestamp
                    orderDirection: desc
                ) {
                    id
                    from
                    to
                    tokenId
                    contract {
                        id
                        name
                        symbol
                    }
                    timestamp
                    transactionHash
                }
            }
        `;

        try {
            const timestampCutoff = Math.floor(Date.now() / 1000) - this.getTimeframeSeconds(timeframe);
            
            const data = await this.makeGraphQLRequest(query, {
                wallet: walletAddress.toLowerCase(),
                timestamp: timestampCutoff
            });

            return this.calculateWalletAnalytics(data.transfers, walletAddress, timeframe, chain);
        } catch (error) {
            console.error('Error fetching wallet analytics:', error);
            throw error;
        }
    }

    // Data transformation methods
    transformNFTResponse(tokens, chain) {
        if (!tokens || !Array.isArray(tokens)) return [];
        
        return tokens.map(token => ({
            processed: true,
            network: chain,
            networkName: this.getNetworkName(chain),
            name: token.metadata?.name || token.contract?.name || 'Unknown NFT',
            description: token.metadata?.description || '',
            image_small_url: token.metadata?.image,
            contract_address: token.contract?.id,
            token_id: token.tokenId,
            owner: token.owner,
            collection_name: token.contract?.name,
            attributes: token.metadata?.attributes || [],
            token_uri: token.tokenURI,
            last_transfer: token.transfers?.[0] ? {
                from: token.transfers[0].from,
                to: token.transfers[0].to,
                timestamp: token.transfers[0].timestamp,
                transaction_hash: token.transfers[0].transactionHash
            } : null
        }));
    }

    transformCollectionData(contract, chain) {
        if (!contract) return null;

        const owners = new Set(contract.tokens?.map(token => token.owner) || []);
        
        return {
            processed: true,
            network: chain,
            networkName: this.getNetworkName(chain),
            name: contract.name,
            description: `Collection with ${contract.totalSupply} total tokens and ${owners.size} unique owners`,
            contract_address: contract.id,
            symbol: contract.symbol,
            total_supply: contract.totalSupply,
            distinct_owner_count: owners.size,
            recent_transfers: contract.transfers?.slice(0, 10) || [],
            tokens_sample: contract.tokens?.slice(0, 5) || []
        };
    }

    transformTransferData(transfers, chain) {
        if (!transfers || !Array.isArray(transfers)) return [];
        
        return transfers.map(transfer => ({
            network: chain,
            networkName: this.getNetworkName(chain),
            id: transfer.id,
            from: transfer.from,
            to: transfer.to,
            token_id: transfer.tokenId,
            contract_address: transfer.contract?.id,
            contract_name: transfer.contract?.name,
            block_number: transfer.blockNumber,
            timestamp: transfer.timestamp,
            transaction_hash: transfer.transactionHash,
            gas_used: transfer.gasUsed,
            gas_price: transfer.gasPrice
        }));
    }

    calculateAnalytics(contract, timeframe, chain) {
        if (!contract || !contract.transfers) return null;

        const transfers = contract.transfers;
        const uniqueBuyers = new Set(transfers.filter(t => t.from !== '0x0000000000000000000000000000000000000000').map(t => t.to));
        const uniqueSellers = new Set(transfers.filter(t => t.to !== '0x0000000000000000000000000000000000000000').map(t => t.from));
        
        return {
            network: chain,
            networkName: this.getNetworkName(chain),
            contract_address: contract.id,
            name: contract.name,
            symbol: contract.symbol,
            timeframe,
            total_transfers: transfers.length,
            unique_buyers: uniqueBuyers.size,
            unique_sellers: uniqueSellers.size,
            total_supply: contract.totalSupply,
            transfer_volume: transfers.length,
            most_active_traders: this.getMostActiveTraders(transfers),
            transfer_timeline: this.getTransferTimeline(transfers)
        };
    }

    calculateWalletAnalytics(transfers, walletAddress, timeframe, chain) {
        if (!transfers || !Array.isArray(transfers)) return null;

        const buys = transfers.filter(t => t.to.toLowerCase() === walletAddress.toLowerCase());
        const sells = transfers.filter(t => t.from.toLowerCase() === walletAddress.toLowerCase());
        const uniqueCollections = new Set(transfers.map(t => t.contract?.id));

        return {
            network: chain,
            networkName: this.getNetworkName(chain),
            wallet_address: walletAddress,
            timeframe,
            total_transactions: transfers.length,
            buys_count: buys.length,
            sells_count: sells.length,
            unique_collections_traded: uniqueCollections.size,
            collections: Array.from(uniqueCollections).map(contractId => {
                const contractTransfers = transfers.filter(t => t.contract?.id === contractId);
                return {
                    contract_address: contractId,
                    name: contractTransfers[0]?.contract?.name,
                    transaction_count: contractTransfers.length
                };
            })
        };
    }

    // Helper methods
    getTimeframeSeconds(timeframe) {
        const timeframes = {
            '1h': 3600,
            '24h': 86400,
            '7d': 604800,
            '30d': 2592000,
            '90d': 7776000
        };
        return timeframes[timeframe] || 604800; // Default to 7 days
    }

    getMostActiveTraders(transfers, limit = 5) {
        const traderCounts = {};
        transfers.forEach(transfer => {
            if (transfer.from !== '0x0000000000000000000000000000000000000000') {
                traderCounts[transfer.from] = (traderCounts[transfer.from] || 0) + 1;
            }
            if (transfer.to !== '0x0000000000000000000000000000000000000000') {
                traderCounts[transfer.to] = (traderCounts[transfer.to] || 0) + 1;
            }
        });

        return Object.entries(traderCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, limit)
            .map(([address, count]) => ({ address, transaction_count: count }));
    }

    getTransferTimeline(transfers) {
        const timeline = {};
        transfers.forEach(transfer => {
            const date = new Date(transfer.timestamp * 1000).toISOString().split('T')[0];
            timeline[date] = (timeline[date] || 0) + 1;
        });

        return Object.entries(timeline)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, count]) => ({ date, transfer_count: count }));
    }
} 