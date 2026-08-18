/* eslint-disable @typescript-eslint/no-unsafe-return */
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiScopeGuard } from './api-scope.guard';
import { ApiScope } from '../api-scope.enum';

describe('ApiScopeGuard', () => {
  const contextWith = (
    requiredScope: ApiScope | undefined,
    apiClient: { scopes: string[] } | undefined,
  ) => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(requiredScope),
    } as unknown as Reflector;
    const request: any = { apiClient };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as unknown as ExecutionContext;
    return { guard: new ApiScopeGuard(reflector), context };
  };

  it('denies by default when no @RequireScope() is declared', () => {
    const { guard, context } = contextWith(undefined, {
      scopes: ['inventory:read'],
    });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('returns false when ApiKeyGuard never ran (no req.apiClient)', () => {
    const { guard, context } = contextWith(ApiScope.INVENTORY_READ, undefined);
    expect(guard.canActivate(context)).toBe(false);
  });

  it('rejects a key missing the required scope', () => {
    const { guard, context } = contextWith(ApiScope.INVENTORY_READ, {
      scopes: [],
    });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows a key with the required scope', () => {
    const { guard, context } = contextWith(ApiScope.INVENTORY_READ, {
      scopes: ['inventory:read'],
    });
    expect(guard.canActivate(context)).toBe(true);
  });
});
