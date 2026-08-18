import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiClientService } from '../api-client.service';

// Authenticates 3rd-party traffic via `X-Api-Key`. Deliberately a separate
// guard from JwtAuthGuard — a partner credential is not a user session, and
// mixing the two identity shapes on req.user/req.apiClient invites bugs.
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiClientService: ApiClientService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers['x-api-key'];
    const rawKey = Array.isArray(header) ? header[0] : header;

    if (!rawKey) {
      throw new UnauthorizedException('Missing X-Api-Key header');
    }

    const result = await this.apiClientService.authenticate(rawKey);

    if (result.status === 'invalid') {
      throw new UnauthorizedException('Invalid API key');
    }
    if (result.status === 'inactive') {
      throw new ForbiddenException('API key has been revoked or has expired');
    }

    request.apiClient = result.client;
    return true;
  }
}
