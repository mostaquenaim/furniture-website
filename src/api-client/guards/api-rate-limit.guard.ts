import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { Request, Response } from 'express';
import Redis from 'ioredis';
import { getRedisUrl, getRedisOptions } from '../../common/utils/redis.utils';

const WINDOW_SECONDS = 60;

// Per-API-key fixed-window rate limiter backed by Redis (already a hard
// runtime dependency of this app via BullModule). IP-based limiting is the
// wrong unit for a server-to-server partner that may sit behind a shared or
// rotating IP, so this keys on the authenticated ApiClient's id instead —
// which requires ApiKeyGuard to have already run and set req.apiClient.
//
// Fails OPEN on a Redis error: a rate limiter outage should never take down
// the whole partner API, and every failure is logged so it's visible.
@Injectable()
export class ApiRateLimitGuard implements CanActivate, OnModuleDestroy {
  private readonly logger = new Logger(ApiRateLimitGuard.name);
  private readonly redis: Redis;

  constructor() {
    const redisUrl = getRedisUrl();
    this.redis = redisUrl
      ? new Redis(redisUrl, { lazyConnect: false, maxRetriesPerRequest: 1 })
      : new Redis({
          ...getRedisOptions(),
          lazyConnect: false,
          maxRetriesPerRequest: 1,
        });
    this.redis.on('error', (err) =>
      this.logger.warn(`Redis connection error: ${err.message}`),
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const apiClient = request.apiClient;

    if (!apiClient) {
      // ApiKeyGuard didn't run / already rejected — nothing to key on.
      return true;
    }

    const bucket = Math.floor(Date.now() / (WINDOW_SECONDS * 1000));
    const redisKey = `partner-api:rate-limit:${apiClient.id}:${bucket}`;

    let count: number;
    try {
      count = await this.redis.incr(redisKey);
      if (count === 1) {
        // A few seconds of slack past the window so a slow clock never
        // leaves a counter stuck without an expiry.
        await this.redis.expire(redisKey, WINDOW_SECONDS + 5);
      }
    } catch (err) {
      this.logger.warn(
        `Rate limiter unavailable, failing open: ${String(err)}`,
      );
      return true;
    }

    const limit = apiClient.rateLimitPerMinute;
    response.setHeader('X-RateLimit-Limit', String(limit));
    response.setHeader(
      'X-RateLimit-Remaining',
      String(Math.max(limit - count, 0)),
    );

    if (count > limit) {
      const secondsIntoWindow = Math.floor(Date.now() / 1000) % WINDOW_SECONDS;
      const retryAfter = WINDOW_SECONDS - secondsIntoWindow;
      response.setHeader('Retry-After', String(retryAfter));
      throw new HttpException(
        'Rate limit exceeded',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }
}
