import { CanActivate, ForbiddenException, Injectable } from '@nestjs/common';
import { isDemoMode } from './demo-seed';

/**
 * Gates the "Generate Random X" endpoints so they only ever work in demo/dev
 * (RENDER==='true' or NODE_ENV==='development') — never against real
 * production data, regardless of who's authenticated.
 */
@Injectable()
export class DemoModeGuard implements CanActivate {
  canActivate(): boolean {
    if (!isDemoMode()) {
      throw new ForbiddenException(
        'Random data generation is only available in demo/dev environments.',
      );
    }
    return true;
  }
}
