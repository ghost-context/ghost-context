export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = (searchParams.get('id') || '').trim();
    const pageParam = (searchParams.get('page') || '').trim();
    const countOnly = searchParams.get('countOnly') === '1';
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

    // Per POAP docs, the current endpoint for event holders is `/event/{id}/poaps`.
    // See: https://documentation.poap.tech/reference/geteventpoaps-2
    // However, older integrations used `/event/{id}/token-holders` which now returns 403 "Missing Authentication Token".
    // Implement a resilient fetch that tries the legacy endpoint first, then falls back to the new one, and parses both shapes.
    const headers = { 'accept': 'application/json', 'x-api-key': apiKey };
    const debug = searchParams.get('debug') === '1';
    const LEGACY_LIMIT = 500; // for /token-holders (older endpoint)
    const POAPS_LIMIT = 300;  // for /poaps (per docs, max 300)

    const buildUrl = (pathBase, pageNum, pageLimit) => `${pathBase}?limit=${pageLimit}&offset=${pageNum * pageLimit}`;

    const extractAddresses = (payload) => {
      const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.tokenHolders)
          ? payload.tokenHolders
          : Array.isArray(payload?.poaps)
            ? payload.poaps
            : Array.isArray(payload?.items)
              ? payload.items
              : Array.isArray(payload?.tokens)
                ? payload.tokens
                : [];
      // Try a variety of shapes for owner/address fields
      const owners = list.map((h) => (
        (h?.owner?.id)
        || (h?.owner?.address)
        || (h?.owner?.account?.address)
        || (h?.account?.address)
        || (typeof h?.owner === 'string' ? h.owner : '')
        || h?.owner_address
        || h?.tokenHolder
        || h?.holder_address
        || h?.address
        || ''
      )).filter(Boolean).map(v => String(v).toLowerCase());
      return owners;
    };

    const fetchPage = async (pageNum, prefer = 'legacy') => {
      const legacyBase = `https://api.poap.tech/event/${encodeURIComponent(id)}/token-holders`;
      const poapsBase = `https://api.poap.tech/event/${encodeURIComponent(id)}/poaps`;
      const first = prefer === 'legacy' ? legacyBase : poapsBase;
      const second = prefer === 'legacy' ? poapsBase : legacyBase;
      const firstLimit = first === legacyBase ? LEGACY_LIMIT : POAPS_LIMIT;

      // Try first path
      let url = buildUrl(first, pageNum, firstLimit);
      if (process.env.NODE_ENV !== 'production') {
        console.log('[POAP Event Holders] request', { id, url, limit: firstLimit, offset: pageNum * firstLimit, page: pageNum });
      }
      let res = await fetch(url, { headers, cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (process.env.NODE_ENV !== 'production') {
          try {
            const keys = Object.keys(data || {});
            const sample = Array.isArray(data) ? data[0] : (Array.isArray(data?.poaps) ? data.poaps?.[0] : Array.isArray(data?.items) ? data.items?.[0] : Array.isArray(data?.tokenHolders) ? data.tokenHolders?.[0] : undefined);
            console.log('[POAP Event Holders] first-path parse', { keys, sampleKeys: sample ? Object.keys(sample) : [], sample });
          } catch {}
        }
        const rawListLen = Array.isArray(data)
          ? data.length
          : Array.isArray(data?.tokenHolders)
            ? data.tokenHolders.length
            : Array.isArray(data?.poaps)
              ? data.poaps.length
              : Array.isArray(data?.items)
                ? data.items.length
                : Array.isArray(data?.tokens)
                  ? data.tokens.length
                  : 0;
        return { ok: true, owners: extractAddresses(data), usedLimit: firstLimit, raw: debug ? data : undefined, pageLength: rawListLen };
      }
      let bodyText = '';
      try { bodyText = await res.text(); } catch { bodyText = ''; }
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[POAP Event Holders] failure', { status: res.status, id, body: bodyText });
      }
      // If 403/404 on legacy, fall back to poaps path
      const secondLimit = second === legacyBase ? LEGACY_LIMIT : POAPS_LIMIT;
      url = buildUrl(second, pageNum, secondLimit);
      if (process.env.NODE_ENV !== 'production') {
        console.log('[POAP Event Holders] fallback request', { id, url, limit: secondLimit, offset: pageNum * secondLimit, page: pageNum });
      }
      res = await fetch(url, { headers, cache: 'no-store' });
      if (!res.ok) {
        let bodyText2 = '';
        try { bodyText2 = await res.text(); } catch { bodyText2 = ''; }
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[POAP Event Holders] fallback failure', { status: res.status, id, body: bodyText2 });
        }
        return { ok: false, status: res.status, body: bodyText2 };
      }
      const data2 = await res.json();
      if (process.env.NODE_ENV !== 'production') {
        try {
          const keys2 = Object.keys(data2 || {});
          const sample2 = Array.isArray(data2) ? data2[0] : (Array.isArray(data2?.poaps) ? data2.poaps?.[0] : Array.isArray(data2?.items) ? data2.items?.[0] : Array.isArray(data2?.tokenHolders) ? data2.tokenHolders?.[0] : undefined);
          console.log('[POAP Event Holders] fallback parse', { keys: keys2, sampleKeys: sample2 ? Object.keys(sample2) : [], sample: sample2 });
        } catch {}
      }
      const rawListLen2 = Array.isArray(data2)
        ? data2.length
        : Array.isArray(data2?.tokenHolders)
          ? data2.tokenHolders.length
          : Array.isArray(data2?.poaps)
            ? data2.poaps.length
            : Array.isArray(data2?.items)
              ? data2.items.length
              : Array.isArray(data2?.tokens)
                ? data2.tokens.length
                : 0;
      return { ok: true, owners: extractAddresses(data2), usedLimit: secondLimit, raw: debug ? data2 : undefined, pageLength: rawListLen2 };
    };

    if (countOnly) {
      // Count unique owners across pages for correctness even if /poaps returns multiple tokens per owner
      const unique = new Set();
      let page = 0;
      while (true) {
        const result = await fetchPage(page, 'legacy');
        if (!result.ok) break;
        const owners = Array.isArray(result.owners) ? result.owners : [];
        for (const addr of owners) unique.add(addr);
        const pageSize = result.usedLimit || POAPS_LIMIT;
        if (process.env.NODE_ENV !== 'production') {
          console.log('[POAP Event Holders] count page', { id, limit: pageSize, offset: page * pageSize, ownersCount: owners.length, rawLength: result.pageLength });
        }
        // Stop when raw page length is less than the limit (last page)
        if ((result.pageLength || 0) < pageSize) break;
        page += 1;
        if (page > 200) break; // safety stop (100k items)
      }
      let total = unique.size;
      // Fallback to event supply if total is zero
      if (total === 0) {
        try {
          const detailsUrl = `https://api.poap.tech/events/id/${encodeURIComponent(id)}`;
          const detailsRes = await fetch(detailsUrl, { headers, cache: 'no-store' });
          if (detailsRes.ok) {
            const ev = await detailsRes.json();
            const supply = Number(ev?.supply || 0);
            if (supply > 0) total = supply;
          }
        } catch {}
      }
      return new Response(JSON.stringify({ id, count: total }), { status: 200, headers: { 'content-type': 'application/json' } });
    }

    // Non-count mode: return a single page of unique holders for the requested page
    const page = pageParam ? Number(pageParam) : 0;
    const result = await fetchPage(page, 'legacy');
    if (!result.ok) {
      return new Response(
        JSON.stringify({ error: 'Lookup failed', id, status: result.status || 502, body: result.body || '' }),
        { status: result.status || 502, headers: { 'content-type': 'application/json' } }
      );
    }
    // Deduplicate within the page
    const unique = Array.from(new Set(result.owners || []));
    const payload = debug ? { id, holders: unique, debug: { usedLimit: result.usedLimit, sampleRaw: Array.isArray(result.raw) ? result.raw.slice(0, 2) : (Array.isArray(result.raw?.poaps) ? result.raw.poaps.slice(0, 2) : (Array.isArray(result.raw?.items) ? result.raw.items.slice(0, 2) : (Array.isArray(result.raw?.tokenHolders) ? result.raw.tokenHolders.slice(0, 2) : result.raw))) } } : { id, holders: unique };
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'Unhandled error', message: e?.message }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}


