/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable } from '@nestjs/common';
import { Redis } from '@upstash/redis';

@Injectable()
export class RedisService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }

  async set(key: string, value: any, ttlSeconds?: number) {
    if (ttlSeconds) {
      return await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
    }
    return await this.redis.set(key, JSON.stringify(value));
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get<string>(key);
    return data ? JSON.parse(data) : null;
  }

  async del(key: string) {
    return await this.redis.del(key);
  }
}
