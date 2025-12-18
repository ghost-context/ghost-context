export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = (searchParams.get('id') || '').trim();
    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing query param: id' }), { status: 400 });
    }

    const apiKey = process.env.POAP_API_KEY || process.env.NEXT_PUBLIC_POAP_API_KEY || '';
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing POAP_API_KEY in environment' }),
        { status: 500 }
      );
    }

    const headers = { 'accept': 'application/json', 'x-api-key': apiKey };
    // Per docs: https://documentation.poap.tech/reference/get_poap_event_by_id
    const url = `https://api.poap.tech/events/id/${encodeURIComponent(id)}`;
    if (process.env.NODE_ENV !== 'production') {
      console.log('[POAP Event Details] request', { id, url });
    }
    const res = await fetch(url, { headers, next: { revalidate: 300 } }); // Cache for 5 minutes
    if (!res.ok) {
      let bodyText = '';
      try { bodyText = await res.text(); } catch { bodyText = ''; }
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[POAP Event Details] failure', { status: res.status, id, body: bodyText });
      }
      return new Response(
        JSON.stringify({ error: 'Lookup failed', id, status: res.status, body: bodyText }),
        { status: res.status || 502, headers: { 'content-type': 'application/json' } }
      );
    }

    const ev = await res.json();
    const payload = {
      id: ev?.id ?? null,
      name: ev?.name ?? '',
      description: ev?.description ?? '',
      image_url: ev?.image_url ?? '',
      city: ev?.city ?? '',
      country: ev?.country ?? '',
      year: ev?.year ?? null,
      start_date: ev?.start_date ?? null,
      end_date: ev?.end_date ?? null,
      supply: ev?.supply ?? null
    };
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'Unhandled error', message: e?.message }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}



