export class NeynarClient {
    constructor(apiKey) {
        this.apiKey = apiKey || process.env.NEXT_PUBLIC_NEYNAR_API_KEY;
        this.baseUrl = 'https://api.neynar.com/v2/farcaster';
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


