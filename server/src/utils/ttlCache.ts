import { Request, Response } from 'express';

interface Entry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Tiny in-memory cache with a per-entry expiry (Map + timestamps, no dependency).
 *
 * Meant for small, public, read-mostly responses on a single instance. It is NOT shared between processes, so
 * after a write on one instance another instance can serve the old value until it expires: keep TTLs short and
 * never put anything user-specific or permission-dependent in it (put the permission level in the key if the
 * response depends on it).
 */
export class TtlCache<T = unknown> {
  private readonly store = new Map<string, Entry<T>>();

  constructor(private readonly maxEntries = 500) {}

  get(key: string): T | undefined {
    if (!cacheEnabled) return undefined;
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    if (!cacheEnabled) return;
    this.store.delete(key); // re-insert so the oldest-first eviction below stays accurate
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }

  /** Returns the cached value, or runs `loader`, stores its result for `ttlMs` and returns it. */
  async wrap(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    const value = await loader();
    this.set(key, value, ttlMs);
    return value;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  /** Removes every entry whose key starts with `prefix` (used to invalidate a whole resource after an admin write). */
  deleteByPrefix(prefix: string): void {
    for (const key of Array.from(this.store.keys())) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

// Off while running the test suite, so tests that create data and immediately read it back always see the
// database. The cache tests switch it on explicitly.
let cacheEnabled = process.env.NODE_ENV !== 'test';
export function setCacheEnabled(enabled: boolean): void {
  cacheEnabled = enabled;
}

/** Public storefront reads: categories, banners, public settings, sitemap. */
export const publicCache = new TtlCache();
/** Admin dashboard/report aggregates. */
export const reportCache = new TtlCache();

export const PUBLIC_TTL_MS = 60_000;
export const REPORT_TTL_MS = 30_000;

/** Cache key for a request: resource name + full path and query string, so `?a=1` and `?a=2` never collide. */
export function cacheKey(resource: string, req: Request): string {
  return `${resource}:${req.originalUrl}`;
}

/** `Cache-Control: public, max-age=30` for responses that are identical for every visitor. */
export function setPublicCacheHeader(res: Response, seconds = 30): void {
  res.setHeader('Cache-Control', `public, max-age=${seconds}`);
}
