import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TtlCache, setCacheEnabled } from '../../src/utils/ttlCache';

describe('TtlCache', () => {
  beforeEach(() => {
    setCacheEnabled(true);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-09T10:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
    setCacheEnabled(false); // the test suite runs with the cache off
  });

  it('returns a value until its TTL passes, then forgets it', () => {
    const cache = new TtlCache<string>();
    cache.set('k', 'v', 60_000);
    expect(cache.get('k')).toBe('v');
    vi.advanceTimersByTime(59_999);
    expect(cache.get('k')).toBe('v');
    vi.advanceTimersByTime(2);
    expect(cache.get('k')).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('wrap() runs the loader once while the entry is fresh and again after expiry', async () => {
    const cache = new TtlCache<number>();
    const loader = vi.fn(async () => 42);
    expect(await cache.wrap('a', 30_000, loader)).toBe(42);
    expect(await cache.wrap('a', 30_000, loader)).toBe(42);
    expect(loader).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(30_001);
    await cache.wrap('a', 30_000, loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('different keys (e.g. different query strings) never collide', () => {
    const cache = new TtlCache<string>();
    cache.set('categories:/api/categories?a=1', 'one', 1000);
    cache.set('categories:/api/categories?a=2', 'two', 1000);
    expect(cache.get('categories:/api/categories?a=1')).toBe('one');
    expect(cache.get('categories:/api/categories?a=2')).toBe('two');
  });

  it('deleteByPrefix removes one resource and leaves the others', () => {
    const cache = new TtlCache<string>();
    cache.set('categories:a', '1', 1000);
    cache.set('categories:b', '2', 1000);
    cache.set('banners:a', '3', 1000);
    cache.deleteByPrefix('categories:');
    expect(cache.get('categories:a')).toBeUndefined();
    expect(cache.get('categories:b')).toBeUndefined();
    expect(cache.get('banners:a')).toBe('3');
  });

  it('is bounded: the oldest entries are evicted past maxEntries', () => {
    const cache = new TtlCache<number>(3);
    for (let i = 0; i < 5; i++) cache.set(`k${i}`, i, 1000);
    expect(cache.size).toBe(3);
    expect(cache.get('k0')).toBeUndefined();
    expect(cache.get('k4')).toBe(4);
  });

  it('stores and returns nothing while caching is switched off', () => {
    setCacheEnabled(false);
    const cache = new TtlCache<string>();
    cache.set('k', 'v', 1000);
    expect(cache.get('k')).toBeUndefined();
  });
});
