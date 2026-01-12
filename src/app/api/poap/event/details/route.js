import { fetchJson } from '../../../../lib/fetch-utils.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = (searchParams.get('id') || '').trim();
    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing query param: id' }), { status: 400, headers: { 'content-type': 'application/json' } });
    }

    const apiKey = process.env.POAP_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing POAP_API_KEY in environment' }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }

    const headers = { 'accept': 'application/json', 'x-api-key': apiKey };
    // Per docs: https://documentation.poap.tech/reference/get_poap_event_by_id
    const url = `https://api.poap.tech/events/id/${encodeURIComponent(id)}`;

    const result = await fetchJson(url, { headers, next: { revalidate: 300 } }, { name: 'POAP Event Details', identifier: id });
    if (!result.ok) return result.error;

    const ev = result.data;
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
    // Always log errors - Vercel captures these logs
    console.error('[POAP Event Details] error', { message: e.message, stack: e.stack?.slice(0, 500) });
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}



