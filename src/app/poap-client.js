/**
 * POAP (Proof of Attendance Protocol) Client
 * Replaces POAP functionality that was previously provided by SimpleHash
 */
export class POAPClient {
    constructor() {
        this.baseUrl = 'https://api.poap.tech';
        // Note: POAP API doesn't require authentication for most read operations
    }

    /**
     * Transform POAP event data to match SimpleHash format
     */
    transformEvent(poapData) {
        if (poapData.processed) return poapData;
        
        return {
            processed: true,
            network: "poap",
            chains: ["poap"],
            networkName: "POAP",
            name: poapData.event?.name || poapData.name,
            description: poapData.event?.description || poapData.description || '',
            image_small_url: poapData.event?.image_url || poapData.image_url,
            contract_address: poapData.event?.id || poapData.event_id,
            large_collection: false
        }
    }

    /**
     * Get POAP events for a wallet address
     */
    async eventsByOwner(walletId, cursor, callback) {
        try {
            const response = await fetch(`${this.baseUrl}/actions/scan/${walletId}`);
            if (!response.ok) {
                throw new Error(`POAP API error: ${response.status}`);
            }
            
            const poaps = await response.json();
            
            // Transform to match SimpleHash format
            const transformedNfts = poaps.map(poap => this.transformEvent(poap));
            
            if (callback) callback(transformedNfts.length);
            
            return {
                nfts: transformedNfts,
                next_cursor: null // POAP API doesn't use cursor pagination for this endpoint
            };
        } catch (err) {
            console.error('Error fetching POAP events:', err);
            return { nfts: [], next_cursor: null };
        }
    }

    /**
     * Get owners of a specific POAP event
     */
    async getOwnersByEvent(eventId, cursor) {
        try {
            // POAP API endpoint for getting event holders
            const response = await fetch(`${this.baseUrl}/event/${eventId}/poaps`);
            if (!response.ok) {
                throw new Error(`POAP API error: ${response.status}`);
            }
            
            const eventData = await response.json();
            
            return {
                owners: eventData.map(poap => [poap.owner.id]), // Nested array to match SimpleHash format
                next_cursor: null // POAP API doesn't use cursor pagination
            };
        } catch (err) {
            console.error('Error fetching POAP event owners:', err);
            return { owners: [], next_cursor: null };
        }
    }

    /**
     * Get owners - unified interface for POAP events
     */
    async getOwners(type, id, cursor) {
        if (type === "poap") {
            return await this.getOwnersByEvent(id, cursor);
        }
        return { owners: [], next_cursor: null };
    }
} 