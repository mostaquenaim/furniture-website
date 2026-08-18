import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { REQUIRE_SCOPE_KEY } from '../decorators/require-scope.decorator';
import { ApiScope } from '../api-scope.enum';

// Must run after ApiKeyGuard — reads req.apiClient, which only ApiKeyGuard
// sets. Mirrors RolesGuard's deny-by-default posture: a partner route
// without @RequireScope() is refused rather than silently left open.
@Injectable()
export class ApiScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredScope = this.reflector.getAllAndOverride<ApiScope>(
      REQUIRE_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredScope) {
      throw new ForbiddenException(
        'This route has no @RequireScope() declared — denying by default.',
      );
    }

    const request = context.switchToHttp().getRequest<Request>();
    const apiClient = request.apiClient;
    if (!apiClient) {
      // ApiKeyGuard didn't run or rejected already — nothing to authorize.
      return false;
    }

    if (!apiClient.scopes.includes(requiredScope)) {
      throw new ForbiddenException(
        `API key does not have the required scope: ${requiredScope}`,
      );
    }

    return true;
  }
}
