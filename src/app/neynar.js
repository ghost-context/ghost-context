export class NeynarClient {
    constructor(apiKey) {
        this.apiKey = apiKey || process.env.NEXT_PUBLIC_NEYNAR_API_KEY;
        this.baseUrl = 'https://api.neynar.com/v2/farcaster';
    }

    // Batch lookup for multiple addresses - returns Map<address, socials[]>
    async batchSocialLookup(addresses) {
        const results = new Map();
        if (!Array.isArray(addresses) || addresses.length === 0) return results;

        // Process in batches of 50 (API limit)
        const BATCH_SIZE = 50;
        for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
            const batch = addresses.slice(i, i + BATCH_SIZE);
            const addrList = batch.map(a => String(a).toLowerCase()).join(',');

            try {
                const isServer = typeof window === 'undefined';
                const url = isServer
                    ? `${this.baseUrl}/user/bulk-by-verifications?addresses=${encodeURIComponent(addrList)}`
                    : `/api/socials/farcaster?addresses=${encodeURIComponent(addrList)}`;

                const res = await fetch(url, {
                    headers: isServer ? {
                        'accept': 'application/json',
                        'api_key': this.apiKey || '',
                        'x-api-key': this.apiKey || ''
                    } : { 'accept': 'application/json' }
                });

                if (!res.ok) continue;

                const data = await res.json();
                // Handle response format - users may have verified_addresses
                const users = data?.users || data?.result?.users || [];
                if (!Array.isArray(users)) continue;

                for (const u of users) {
                    const username = u?.username || u?.profile?.username;
                    if (!username) continue;

                    const pfp = u?.pfp_url || u?.profile?.pfp?.url || '';
                    const social = {
                        dappName: 'farcaster',
                        profileName: username,
                        profileImage: pfp,
                        followerCount: u?.follower_count || 0,
                        followingCount: u?.following_count || 0,
                        link: `https://warpcast.com/${username}`
                    };

                    // Map to all verified addresses for this user
                    const verifiedAddrs = u?.verified_addresses?.eth_addresses || [];
                    for (const addr of verifiedAddrs) {
                        const key = String(addr).toLowerCase();
                        if (!results.has(key)) results.set(key, []);
                        results.get(key).push(social);
                    }
                }
            } catch (e) {
                // Silently continue on errors
            }
        }

        return results;
    }

    async socialLookup(address) {
        try {
            if (!address) return [];
            const addr = String(address).toLowerCase();
            const isServer = typeof window === 'undefined';
            const url = isServer
                ? `${this.baseUrl}/user/bulk-by-verifications?addresses=${encodeURIComponent(addr)}`
                : `/api/socials/farcaster?address=${encodeURIComponent(addr)}`;
            if (!this.apiKey && typeof window !== 'undefined') {
                console.warn('Neynar: Missing NEXT_PUBLIC_NEYNAR_API_KEY; Farcaster lookup will fail with 401');
            }
            const res = await fetch(url, {
                headers: isServer ? {
                    'accept': 'application/json',
                    'api_key': this.apiKey || '',
                    'x-api-key': this.apiKey || ''
                } : { 'accept': 'application/json' }
            });
            if (!res.ok) {
                let bodyText = '';
                try { bodyText = await res.text(); } catch (_) {}
                if (typeof window !== 'undefined') {
                    console.warn('Neynar: lookup failed', { address: addr, status: res.status, body: bodyText });
                }
                return [];
            }
            const data = await res.json();
            if (!isServer && Array.isArray(data?.socials)) return data.socials;

            let users = data?.users || data?.result?.users || [];
            if (!Array.isArray(users)) users = [];
            return users
              .map((u) => {
                const username = u?.username || u?.profile?.username;
                const pfp = u?.pfp_url || u?.profile?.pfp?.url || '';
                return username
                  ? {
                      dappName: 'farcaster',
                      profileName: username,
                      profileImage: pfp,
                      followerCount: u?.follower_count || 0,
                      followingCount: u?.following_count || 0,
                      link: `https://warpcast.com/${username}`
                    }
                  : null;
              })
              .filter(Boolean);
        } catch (e) {
            if (typeof window !== 'undefined') {
                console.warn('Neynar: lookup exception', { address, message: e?.message });
            }
            return [];
        }
    }
}


