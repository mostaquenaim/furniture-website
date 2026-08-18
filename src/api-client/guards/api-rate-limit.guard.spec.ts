import { ExecutionContext, HttpException } from '@nestjs/common';
import { ApiRateLimitGuard } from './api-rate-limit.guard';

const mockRedisInstance = {
  incr: jest.fn(),
  expire: jest.fn(),
  disconnect: jest.fn(),
  on: jest.fn(),
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedisInstance);
});

describe('ApiRateLimitGuard', () => {
  let guard: ApiRateLimitGuard;

  const contextFor = (apiClient: any) => {
    const request: any = { apiClient };
    const headers: Record<string, string> = {};
    const response: any = {
      setHeader: (key: string, value: string) => {
        headers[key] = value;
      },
    };
    return {
      context: {
        switchToHttp: () => ({
          getRequest: () => request,
          getResponse: () => response,
        }),
      } as unknown as ExecutionContext,
      headers,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new ApiRateLimitGuard();
  });

  it('passes through when ApiKeyGuard never ran (no req.apiClient)', async () => {
    const { context } = contextFor(undefined);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(mockRedisInstance.incr).not.toHaveBeenCalled();
  });

  it('allows requests under the limit and sets rate-limit headers', async () => {
    mockRedisInstance.incr.mockResolvedValue(1);
    const { context, headers } = contextFor({
      id: 1,
      rateLimitPerMinute: 60,
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(mockRedisInstance.expire).toHaveBeenCalled();
    expect(headers['X-RateLimit-Limit']).toBe('60');
    expect(headers['X-RateLimit-Remaining']).toBe('59');
  });

  it('throws 429 with Retry-After once the limit is exceeded', async () => {
    mockRedisInstance.incr.mockResolvedValue(61);
    const { context, headers } = contextFor({
      id: 1,
      rateLimitPerMinute: 60,
    });

    await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
    expect(headers['Retry-After']).toBeDefined();
  });

  it('fails open when Redis is unavailable', async () => {
    mockRedisInstance.incr.mockRejectedValue(new Error('ECONNREFUSED'));
    const { context } = contextFor({ id: 1, rateLimitPerMinute: 60 });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
