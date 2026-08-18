/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { ApiClientService } from '../api-client.service';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let apiClientService: { authenticate: jest.Mock };

  const contextFor = (headers: Record<string, string | undefined>) => {
    const request: any = { headers };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    apiClientService = { authenticate: jest.fn() };
    guard = new ApiKeyGuard(apiClientService as unknown as ApiClientService);
  });

  it('rejects a request with no X-Api-Key header', async () => {
    await expect(guard.canActivate(contextFor({}))).rejects.toThrow(
      UnauthorizedException,
    );
    expect(apiClientService.authenticate).not.toHaveBeenCalled();
  });

  it('rejects an unknown/wrong key with 401', async () => {
    apiClientService.authenticate.mockResolvedValue({ status: 'invalid' });
    await expect(
      guard.canActivate(contextFor({ 'x-api-key': 'sk_live_bogus' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a revoked/expired key with 403, not 401', async () => {
    apiClientService.authenticate.mockResolvedValue({ status: 'inactive' });
    await expect(
      guard.canActivate(contextFor({ 'x-api-key': 'sk_live_revoked' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows a valid key and attaches req.apiClient', async () => {
    const client = {
      id: 1,
      name: 'Test',
      scopes: ['inventory:read'],
      rateLimitPerMinute: 60,
    };
    apiClientService.authenticate.mockResolvedValue({
      status: 'active',
      client,
    });

    const request: any = { headers: { 'x-api-key': 'sk_live_good' } };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.apiClient).toBe(client);
  });

  it('reads the first value when the header is duplicated', async () => {
    apiClientService.authenticate.mockResolvedValue({ status: 'invalid' });
    await guard
      .canActivate(contextFor({ 'x-api-key': undefined }))
      .catch(() => undefined);

    const request: any = { headers: { 'x-api-key': ['a', 'b'] as any } };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    await guard.canActivate(context).catch(() => undefined);
    expect(apiClientService.authenticate).toHaveBeenCalledWith('a');
  });
});
