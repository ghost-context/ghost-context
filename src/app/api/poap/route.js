export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const raw = (searchParams.get('address') || '').trim();
    const dropIdParam = (searchParams.get('dropId') || '').trim();
    const debug = searchParams.get('debug') === '1';
    if (!raw) {
      return new Response(JSON.stringify({ error: 'Missing query param: address' }), { status: 400 });
    }

    const address = raw.toLowerCase();
    const dropId = dropIdParam ? Number(dropIdParam) : undefined;

    const apiKey = process.env.POAP_API_KEY || process.env.NEXT_PUBLIC_POAP_API_KEY || '';
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing POAP_API_KEY in environment' }),
        { status: 500 }
      );
    }

    const headers = { 'accept': 'application/json', 'x-api-key': apiKey };
    const url = `https://api.poap.tech/actions/scan/${encodeURIComponent(address)}`;
    if (process.env.NODE_ENV !== 'production') {
      console.log('[POAP API] request', { url, address, dropId });
    }

    const res = await fetch(url, { headers, next: { revalidate: 300 } }); // Cache for 5 minutes
    if (!res.ok) {
      let bodyText = '';
      try { bodyText = await res.text(); } catch { bodyText = ''; }
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[POAP API] failure', { status: res.status, address, body: bodyText });
      }
      return new Response(
        JSON.stringify({ error: 'Lookup failed', address, status: res.status, body: bodyText }),
        { status: res.status || 502, headers: { 'content-type': 'application/json' } }
      );
    }

    const events = await res.json();
    const simplified = Array.isArray(events)
      ? events.map(e => ({ id: e?.event?.id ?? e?.id, name: e?.event?.name ?? e?.name, image_url: e?.event?.image_url ?? e?.image_url, created: e?.created }))
      : [];
    const hasDrop = dropId ? simplified.some(e => Number(e.id) === dropId) : false;
    const payload = debug
      ? { address, count: simplified.length, hasDrop, events: simplified, raw: events }
      : { address, count: simplified.length, hasDrop, events: simplified };
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'Unhandled error', message: e?.message }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}


