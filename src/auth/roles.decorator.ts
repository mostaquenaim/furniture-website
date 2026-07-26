import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

// Hard allowlist, independent of the DB-driven permission table — use for
// actions (like granting roles) that must never become togglable via
// PermissionService.setPermission.
export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
