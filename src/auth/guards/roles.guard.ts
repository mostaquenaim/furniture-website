/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionService } from 'src/permission/permission.service';
import { UserRole } from '@prisma/client';
import { PERMISSION_KEY } from 'src/permission/permission.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(
    private reflector: Reflector,
    private permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) return false;

    // SUPERADMIN always passes — no DB lookup needed
    if (user.role === UserRole.SUPERADMIN) return true;

    // Read the action declared on this route via @Permission(...)
    const requiredAction = this.reflector.getAllAndOverride<string>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @Permission decorator on this route → deny by default
    // (all admin routes should have one)
    if (!requiredAction) {
      this.logger.warn(
        `Route has no @Permission decorator: ${request.method} ${request.url}`,
      );
      return false;
    }

    const allowed = await this.permissionService.isAllowed(
      user.role,
      requiredAction,
    );

    if (!allowed) {
      throw new ForbiddenException(
        `Role ${user.role} does not have permission: ${requiredAction}`,
      );
    }

    return true;
  }
}
