export class PoapClient {
  constructor(baseUrl = '/api/poap') {
    this.baseUrl = baseUrl;
  }

  async scanAddress(address, dropId) {
    const url = new URL(this.baseUrl, typeof window === 'undefined' ? 'http://localhost' : window.location.origin);
    url.searchParams.set('address', address);
    if (dropId != null) url.searchParams.set('dropId', String(dropId));
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) {
      let body = '';
      try { body = await res.text(); } catch {}
      throw new Error(`POAP scan failed: ${res.status} ${body}`);
    }
    return res.json();
  }

  async hasDrop(address, dropId) {
    if (dropId == null) return false;
    const data = await this.scanAddress(address, dropId);
    return Boolean(data?.hasDrop);
  }

  async getEventHolders(eventId, page = 0) {
    const url = new URL('/api/poap/event', typeof window === 'undefined' ? 'http://localhost' : window.location.origin);
    url.searchParams.set('id', String(eventId));
    url.searchParams.set('page', String(page));
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) {
      let body = '';
      try { body = await res.text(); } catch {}
      throw new Error(`POAP holders failed: ${res.status} ${body}`);
    }
    return res.json();
  }
}


