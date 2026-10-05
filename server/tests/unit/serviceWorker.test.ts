import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Loads the real admin/public/sw.js into a sandbox that imitates the browser's service-worker environment, so
 * its fetch handler can be driven with fake requests. No browser needed.
 */
const SW_SOURCE = fs.readFileSync(path.join(__dirname, '../../../admin/public/sw.js'), 'utf8');

type Handler = (event: unknown) => void;

function load() {
  const listeners: Record<string, Handler> = {};
  const stores = new Map<string, Map<string, unknown>>();
  const networkCalls: string[] = [];
  let online = true;

  const cacheApi = {
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return {
        add: async (req: { url?: string } | string) => store.set(typeof req === 'string' ? req : req.url!, { ok: true }),
        put: async (req: { url: string }, res: unknown) => store.set(req.url, res),
        match: async (req: { url: string } | string) => store.get(typeof req === 'string' ? req : req.url)
      };
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name)
  };

  const sandbox: Record<string, unknown> = {
    URL, Request: class { url: string; constructor(u: string) { this.url = u; } }, Response: class { status: number; constructor(_b: unknown, init?: { status?: number }) { this.status = init?.status ?? 200; } },
    Promise, console,
    caches: cacheApi,
    fetch: async (req: { url: string }) => {
      networkCalls.push(req.url);
      if (!online) throw new Error('offline');
      return { ok: true, clone() { return this; }, url: req.url };
    },
    self: {
      location: { origin: 'https://admin.example.com' },
      addEventListener: (type: string, fn: Handler) => { listeners[type] = fn; },
      skipWaiting: async () => undefined,
      clients: { claim: async () => undefined }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(SW_SOURCE, sandbox);

  async function fetchEvent(url: string, opts: { method?: string; mode?: string } = {}) {
    let responded: Promise<unknown> | null = null;
    const event = {
      request: { url, method: opts.method ?? 'GET', mode: opts.mode ?? 'cors' },
      respondWith: (p: Promise<unknown>) => { responded = Promise.resolve(p); }
    };
    listeners.fetch(event);
    return responded ? await responded : undefined; // undefined = the service worker did not handle it
  }
  async function lifecycle(type: 'install' | 'activate') {
    const waits: Promise<unknown>[] = [];
    listeners[type]({ waitUntil: (p: Promise<unknown>) => waits.push(Promise.resolve(p)) });
    await Promise.all(waits);
  }
  return { fetchEvent, lifecycle, stores, networkCalls, setOnline: (v: boolean) => (online = v), listeners };
}

describe('admin service worker (sw.js)', () => {
  it('NEVER handles /api/ requests, so private data is never cached', async () => {
    const sw = load();
    await sw.lifecycle('install');
    for (const url of [
      'https://admin.example.com/api/bookings/technician/my-jobs',
      'https://admin.example.com/api/customers',
      'https://admin.example.com/api/auth/me'
    ]) {
      expect(await sw.fetchEvent(url)).toBeUndefined();
    }
    const all = [...sw.stores.values()].flatMap((m) => [...m.keys()]);
    expect(all.some((k) => k.includes('/api/'))).toBe(false);
  });

  it('ignores other origins (the API server, Cloudinary, fonts) and non-GET requests', async () => {
    const sw = load();
    expect(await sw.fetchEvent('https://api.other.com/api/anything')).toBeUndefined();
    expect(await sw.fetchEvent('https://res.cloudinary.com/x.jpg')).toBeUndefined();
    expect(await sw.fetchEvent('https://admin.example.com/assets/app.js', { method: 'POST' })).toBeUndefined();
  });

  it('page loads go to the network first, so a new deploy is never masked by a stale index.html', async () => {
    const sw = load();
    await sw.lifecycle('install');
    sw.networkCalls.length = 0;
    const res = (await sw.fetchEvent('https://admin.example.com/my-jobs', { mode: 'navigate' })) as { ok: boolean };
    expect(res.ok).toBe(true);
    expect(sw.networkCalls).toEqual(['https://admin.example.com/my-jobs']);
  });

  it('shows the offline page only when the network is really down', async () => {
    const sw = load();
    await sw.lifecycle('install');
    sw.setOnline(false);
    const res = (await sw.fetchEvent('https://admin.example.com/my-jobs', { mode: 'navigate' })) as { ok?: boolean; status?: number };
    expect(res.ok).toBe(true); // the cached /offline.html
  });

  it('caches hashed build assets and serves them from cache next time', async () => {
    const sw = load();
    await sw.fetchEvent('https://admin.example.com/assets/index-abc123.js');
    sw.networkCalls.length = 0;
    await sw.fetchEvent('https://admin.example.com/assets/index-abc123.js');
    expect(sw.networkCalls).toEqual([]); // second request came from cache
  });

  it('deletes caches from older versions on activate (old versions stored API responses)', async () => {
    const sw = load();
    sw.stores.set('techportal-api-v1', new Map([['https://admin.example.com/api/customers', {}]]));
    sw.stores.set('techportal-shell-v2', new Map());
    await sw.lifecycle('activate');
    expect([...sw.stores.keys()].some((k) => /api-v1|shell-v2/.test(k))).toBe(false);
  });

  it('wipes every cache on CLEAR_CACHES (sent at sign-out)', async () => {
    const sw = load();
    await sw.lifecycle('install');
    await sw.fetchEvent('https://admin.example.com/assets/a.js');
    expect(sw.stores.size).toBeGreaterThan(0);
    const waits: Promise<unknown>[] = [];
    sw.listeners.message({ data: 'CLEAR_CACHES', waitUntil: (p: Promise<unknown>) => waits.push(Promise.resolve(p)) });
    await Promise.all(waits);
    expect(sw.stores.size).toBe(0);
  });

  it('every file the manifest and offline page rely on actually exists in admin/public', () => {
    const pub = path.join(__dirname, '../../../admin/public');
    const manifest = JSON.parse(fs.readFileSync(path.join(pub, 'manifest.json'), 'utf8'));
    for (const icon of manifest.icons) expect(fs.existsSync(path.join(pub, icon.src)), icon.src).toBe(true);
    expect(fs.existsSync(path.join(pub, 'offline.html'))).toBe(true);
    expect(SW_SOURCE).not.toContain('favicon.ico'); // the old install list named a file that did not exist
  });
});
