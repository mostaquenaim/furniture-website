import { RedisOptions } from 'ioredis';

export function getRedisUrl(): string | undefined {
  return process.env.REDIS_URL || undefined;
}

// Fallback for local dev without a REDIS_URL (e.g. a plain local Redis).
export function getRedisOptions(): RedisOptions {
  return {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
  };
}

// Bull's own redis-url parser (bull/lib/queue.js) strips the scheme and
// never sets `tls`, so handing it a raw "rediss://" string makes it connect
// over plain TCP to a TLS-only port (e.g. Upstash) and hang silently. Always
// resolve to an explicit options object so `tls` is set ourselves.
export function getRedisConnection(): RedisOptions {
  const redisUrl = getRedisUrl();
  if (!redisUrl) {
    return getRedisOptions();
  }

  const parsed = new URL(redisUrl);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
  };
}
