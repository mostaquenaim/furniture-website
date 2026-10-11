import { Injectable } from '@nestjs/common';

interface CacheEntry {
  value: unknown;
  expiresAt: number;
  bytes: number;
}

/**
 * Short-lived in-process cache for anonymous storefront reads — responses
 * that are identical for every caller. Never put anything user-, role- or
 * admin-specific in here.
 *
 * - Cached values are shared between requests: treat them as read-only.
 * - Only successful results are stored; a loader that throws is not cached.
 * - Concurrent misses for the same key share one loader call, so a burst of
 *   traffic on a cold key runs the query once instead of N times.
 * - Bounded by entry count and approximate serialized size, oldest first, so
 *   arbitrary query-string combinations can't grow memory without limit.
 * - clear() also drops in-flight loads, so a query that started before a
 *   write can't put its pre-write result back in afterwards.
 *
 * Per process: with several app instances each has its own copy, and a
 * clear() only reaches the instance that made the write — the TTL bounds
 * how stale the others can be.
 */
@Injectable()
export class PublicReadCacheService {
  static readonly MAX_ENTRIES = 2000;
  static readonly MAX_TOTAL_BYTES = 64 * 1024 * 1024;
  static readonly MAX_ENTRY_BYTES = 4 * 1024 * 1024;
  // Rough per-entry overhead (Map slot, entry object, key) so many tiny
  // entries still count against the byte budget.
  private static readonly ENTRY_OVERHEAD_BYTES = 200;

  private readonly entries = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private totalBytes = 0;
  private generation = 0;

  async getOrLoad<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    const hit = this.entries.get(key);
    if (hit) {
      if (hit.expiresAt > Date.now()) return hit.value as T;
      this.remove(key);
    }

    const pending = this.inFlight.get(key);
    if (pending) return pending as Promise<T>;

    const generation = this.generation;
    // .then() so the loader always runs asynchronously, after `load` is
    // assigned — the finally() below compares against it.
    const load: Promise<T> = Promise.resolve()
      .then(loader)
      .then((value) => {
        if (generation === this.generation) this.store(key, value, ttlSeconds);
        return value;
      })
      .finally(() => {
        if (this.inFlight.get(key) === load) this.inFlight.delete(key);
      });

    this.inFlight.set(key, load);
    return load;
  }

  clear(): void {
    this.entries.clear();
    this.inFlight.clear();
    this.totalBytes = 0;
    this.generation++;
  }

  private store(key: string, value: unknown, ttlSeconds: number): void {
    let serialized: string | undefined;
    try {
      serialized = JSON.stringify(value);
    } catch {
      return; // not serializable → wouldn't be sendable either; skip caching
    }

    const bytes =
      (serialized?.length ?? 0) +
      key.length +
      PublicReadCacheService.ENTRY_OVERHEAD_BYTES;
    if (bytes > PublicReadCacheService.MAX_ENTRY_BYTES) return;

    this.remove(key);
    while (
      this.entries.size > 0 &&
      (this.entries.size >= PublicReadCacheService.MAX_ENTRIES ||
        this.totalBytes + bytes > PublicReadCacheService.MAX_TOTAL_BYTES)
    ) {
      const oldestKey = this.entries.keys().next().value as string;
      this.remove(oldestKey);
    }

    this.entries.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
      bytes,
    });
    this.totalBytes += bytes;
  }

  private remove(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.entries.delete(key);
    this.totalBytes -= entry.bytes;
  }
}
