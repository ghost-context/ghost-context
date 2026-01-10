import { validateAddressParam } from '../../lib/validation.js';
import { fetchJson } from '../../lib/fetch-utils.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const raw = (searchParams.get('address') || '').trim();
    const dropIdParam = (searchParams.get('dropId') || '').trim();
    // Only allow debug param in non-production
    const debug = process.env.NODE_ENV !== 'production' && searchParams.get('debug') === '1';

    const address = raw.toLowerCase();

    // Validate address format
    const validationError = validateAddressParam(address);
    if (validationError) return validationError;
    const dropId = dropIdParam ? Number(dropIdParam) : undefined;

    const apiKey = process.env.POAP_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing POAP_API_KEY in environment' }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }

    const headers = { 'accept': 'application/json', 'x-api-key': apiKey };
    const url = `https://api.poap.tech/actions/scan/${encodeURIComponent(address)}`;

    const result = await fetchJson(url, { headers, next: { revalidate: 300 } }, { name: 'POAP API', identifier: address });
    if (!result.ok) return result.error;

    const events = result.data;
    const simplified = Array.isArray(events)
      ? events.map(e => ({ id: e?.event?.id ?? e?.id, name: e?.event?.name ?? e?.name, image_url: e?.event?.image_url ?? e?.image_url, created: e?.created }))
      : [];
    const hasDrop = dropId ? simplified.some(e => Number(e.id) === dropId) : false;
    const payload = debug
      ? { address, count: simplified.length, hasDrop, events: simplified, raw: events }
      : { address, count: simplified.length, hasDrop, events: simplified };
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[POAP API] error', e);
    }
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}


