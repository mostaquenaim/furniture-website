// import {
//   Injectable,
//   CanActivate,
//   ExecutionContext,
//   Logger,
// } from '@nestjs/common';
// import { Reflector } from '@nestjs/core';
// import { PermissionService } from 'src/permission/permission.service';

// @Injectable()
// export class RolesGuard implements CanActivate {
//   private readonly logger = new Logger(RolesGuard.name);
//   constructor(
//     private reflector: Reflector,
//     private permissionService: PermissionService,
//   ) {}

//   async canActivate(context: ExecutionContext): Promise<boolean> {
//     const request = context.switchToHttp().getRequest();
//     const user = request.user;
//     if (!user) {
//       return false;
//     }

//     const method = request.method as string; // e.g., 'POST'

//     const route = request.route.path; // e.g., 'update-courier'

//     const routePerm = await this.permissionService.getRolesForRoute(
//       route,
//       method,
//     );
//     if (!routePerm) return false;

//     return routePerm.includes(user.role);
//   }
// }

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
import { SKIP_PERMISSION_KEY } from 'src/permission/skip-permission.decorator';
import { ROLES_KEY } from './roles.decorator';

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

    // Hard allowlist via @Roles(...) — takes priority over @SkipPermission()
    // and the togglable permission table. Use for actions (like granting
    // roles) that must never become configurable by a non-superadmin.
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (requiredRoles) {
      if (!requiredRoles.includes(user.role)) {
        throw new ForbiddenException(
          `Role ${user.role} is not permitted to perform this action.`,
        );
      }
      return true;
    }

    // Explicitly skipped → allow all authenticated admin roles
    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skip) return true;

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
