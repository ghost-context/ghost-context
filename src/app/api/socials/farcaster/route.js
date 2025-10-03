export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const raw = (searchParams.get('address') || '').trim();
    const debug = searchParams.get('debug') === '1';
    if (!raw) {
      return new Response(JSON.stringify({ error: 'Missing query param: address' }), { status: 400 });
    }
    const address = raw.toLowerCase();

    const apiKey = process.env.NEYNAR_API_KEY || process.env.NEXT_PUBLIC_NEYNAR_API_KEY || '';
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing NEYNAR_API_KEY in environment' }),
        { status: 500 }
      );
    }

    const headers = { 'accept': 'application/json', 'x-api-key': apiKey };

    // Per docs: https://docs.neynar.com/reference/fetch-bulk-users-by-eth-or-sol-address
    const url = `https://api.neynar.com/v2/farcaster/user/bulk-by-address/?addresses=${encodeURIComponent(address)}&address_types=verified_address,custody_address`;
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Farcaster API] request', { url, address });
    }
    const res = await fetch(url, { headers, cache: 'no-store' });
    if (!res.ok) {
      let bodyText = '';
      try { bodyText = await res.text(); } catch { bodyText = ''; }
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[Farcaster API] failure', { status: res.status, address, body: bodyText });
      }
      return new Response(
        JSON.stringify({ error: 'Lookup failed', address, status: res.status, body: bodyText }),
        { status: res.status || 502, headers: { 'content-type': 'application/json' } }
      );
    }

    const data = await res.json();
    // bulk-by-address returns an object keyed by address -> [users]
    const mappedUsers = Array.isArray(data?.users)
      ? data.users
      : Array.isArray(data?.result?.users)
      ? data.result.users
      : Array.isArray(data?.[address])
      ? data[address]
      : Array.isArray(data?.result?.[address])
      ? data.result[address]
      : [];

    if (process.env.NODE_ENV !== 'production') {
      console.log('[Farcaster API] success', { address, usersCount: mappedUsers.length });
    }
    const socials = mappedUsers
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
              link: `https://warpcast.com/${username}`,
            }
          : null;
      })
      .filter(Boolean);

    const payload = debug ? { address, socials, raw: data } : { address, socials };
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'Unhandled error', message: e?.message }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}


