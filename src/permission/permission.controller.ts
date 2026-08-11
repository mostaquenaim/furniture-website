/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { PermissionService } from './permission.service';
import { RolesGuard } from 'src/auth/roles.guard';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { UserRole } from '@prisma/client';
import { Action } from './action.enum';
import { SkipPermission } from './skip-permission.decorator';

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

  @Get('all')
  getAllPermissions() {
    return this.permissionService.getAllPermissions();
  }

  @Patch('bulk')
  async bulkUpdate(
    @Body()
    body: {
      changes: { action: string; role: UserRole; enabled: boolean }[];
    },
  ) {
    return Promise.all(
      body.changes.map(({ action, role, enabled }) =>
        this.permissionService.setPermission(role, action as Action, enabled),
      ),
    );
  }
}
