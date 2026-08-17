/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { PermissionService } from './permission.service';
import { RolesGuard } from 'src/auth/roles.guard';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { UserRole } from '@prisma/client';
import { SkipPermission } from './skip-permission.decorator';
import { Roles } from 'src/auth/roles.decorator';

@Controller('permissions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  // Any authenticated admin can read their own granted actions — used by
  // the frontend to decide what to show, not a security boundary itself
  // (routes remain individually guarded by @Permission).
  @Get('mine')
  @SkipPermission()
  async getMine(@Req() req: any) {
    const role: UserRole = req.user.role;
    const actions = await this.permissionService.getActionsForRole(role);
    return { role, actions };
  }

  // Grants/toggles are superadmin-only, and hard-coded via @Roles rather than
  // the togglable @Permission table — a superadmin must never be able to
  // configure another role's way into managing permissions.
  @Get('all')
  @Roles(UserRole.SUPERADMIN)
  getAllPermissions() {
    return this.permissionService.getAllPermissions();
  }

  @Patch('bulk')
  @Roles(UserRole.SUPERADMIN)
  async bulkUpdate(
    @Body()
    body: {
      changes: { action: string; role: UserRole; enabled: boolean }[];
    },
    @Req() req: any,
  ) {
    return this.permissionService.bulkSetPermissions(
      body.changes,
      req?.user?.userId,
    );
  }
}
