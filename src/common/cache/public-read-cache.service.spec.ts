import { PublicReadCacheService } from './public-read-cache.service';

describe('PublicReadCacheService', () => {
  let cache: PublicReadCacheService;

  beforeEach(() => {
    cache = new PublicReadCacheService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('serves a hit without calling the loader again', async () => {
    const loader = jest.fn().mockResolvedValue({ a: 1 });

    await expect(cache.getOrLoad('k', 60, loader)).resolves.toEqual({ a: 1 });
    await expect(cache.getOrLoad('k', 60, loader)).resolves.toEqual({ a: 1 });

    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('keeps keys separate', async () => {
    await cache.getOrLoad('a', 60, () => Promise.resolve('A'));
    await expect(
      cache.getOrLoad('b', 60, () => Promise.resolve('B')),
    ).resolves.toBe('B');
  });

  it('reloads once the TTL has passed', async () => {
    jest.useFakeTimers();
    const loader = jest
      .fn()
      .mockResolvedValueOnce('old')
      .mockResolvedValueOnce('new');

    await cache.getOrLoad('k', 60, loader);
    jest.advanceTimersByTime(59_000);
    await expect(cache.getOrLoad('k', 60, loader)).resolves.toBe('old');
    jest.advanceTimersByTime(2_000);
    await expect(cache.getOrLoad('k', 60, loader)).resolves.toBe('new');

    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('does not cache a failed load', async () => {
    const loader = jest
      .fn()
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce('ok');

    await expect(cache.getOrLoad('k', 60, loader)).rejects.toThrow('db down');
    await expect(cache.getOrLoad('k', 60, loader)).resolves.toBe('ok');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('does not cache a loader that throws synchronously', async () => {
    const loader = jest
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('sync');
      })
      .mockResolvedValueOnce('ok');

    await expect(cache.getOrLoad('k', 60, loader)).rejects.toThrow('sync');
    await expect(cache.getOrLoad('k', 60, loader)).resolves.toBe('ok');
  });

  it('shares one load between concurrent misses', async () => {
    let resolve!: (v: string) => void;
    const loader = jest.fn(() => new Promise<string>((r) => (resolve = r)));

    const first = cache.getOrLoad('k', 60, loader);
    const second = cache.getOrLoad('k', 60, loader);
    await Promise.resolve(); // let the deferred loader start
    resolve('v');

    await expect(Promise.all([first, second])).resolves.toEqual(['v', 'v']);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('clear() drops cached values', async () => {
    const loader = jest
      .fn()
      .mockResolvedValueOnce('before')
      .mockResolvedValueOnce('after');

    await cache.getOrLoad('k', 60, loader);
    cache.clear();
    await expect(cache.getOrLoad('k', 60, loader)).resolves.toBe('after');
  });

  it('a load that started before clear() is not stored, and new callers do not join it', async () => {
    let resolveStale!: (v: string) => void;
    const staleLoader = jest.fn(
      () => new Promise<string>((r) => (resolveStale = r)),
    );
    const stale = cache.getOrLoad('k', 60, staleLoader);
    await Promise.resolve();

    cache.clear(); // a write lands while the read is in flight

    const freshLoader = jest.fn().mockResolvedValue('fresh');
    const fresh = cache.getOrLoad('k', 60, freshLoader);

    resolveStale('stale');
    await expect(stale).resolves.toBe('stale'); // its own caller still gets it
    await expect(fresh).resolves.toBe('fresh');
    expect(freshLoader).toHaveBeenCalledTimes(1);

    // ...and the pre-clear value never made it into the cache
    const next = jest.fn().mockResolvedValue('unused');
    await expect(cache.getOrLoad('k', 60, next)).resolves.toBe('fresh');
    expect(next).not.toHaveBeenCalled();
  });

  it('does not cache a value larger than the per-entry limit', async () => {
    const big = 'x'.repeat(PublicReadCacheService.MAX_ENTRY_BYTES + 1);
    const loader = jest.fn().mockResolvedValue(big);

    await cache.getOrLoad('k', 60, loader);
    await cache.getOrLoad('k', 60, loader);

    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('evicts the oldest entries to stay within the byte budget', async () => {
    // Each value is just under the per-entry limit; the budget fits only so many
    const size = PublicReadCacheService.MAX_ENTRY_BYTES - 1000;
    const fits = Math.floor(
      PublicReadCacheService.MAX_TOTAL_BYTES /
        PublicReadCacheService.MAX_ENTRY_BYTES,
    );
    const value = 'x'.repeat(size);

    for (let i = 0; i <= fits; i++) {
      await cache.getOrLoad(`k${i}`, 60, () => Promise.resolve(value));
    }

    const oldest = jest.fn().mockResolvedValue(value);
    await cache.getOrLoad('k0', 60, oldest);
    expect(oldest).toHaveBeenCalledTimes(1); // was evicted

    const newest = jest.fn().mockResolvedValue(value);
    await cache.getOrLoad(`k${fits}`, 60, newest);
    expect(newest).not.toHaveBeenCalled(); // still cached
  });

  it('evicts the oldest entries beyond the entry-count limit', async () => {
    for (let i = 0; i <= PublicReadCacheService.MAX_ENTRIES; i++) {
      await cache.getOrLoad(`k${i}`, 60, () => Promise.resolve(i));
    }

    const oldest = jest.fn().mockResolvedValue(0);
    await cache.getOrLoad('k0', 60, oldest);
    expect(oldest).toHaveBeenCalledTimes(1);
  });
});
