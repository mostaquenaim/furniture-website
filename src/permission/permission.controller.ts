/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { PermissionService } from './permission.service';
import { RolesGuard } from 'src/auth/roles.guard';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { UserRole } from '@prisma/client';
import { Action } from './action.enum';

@Controller('permissions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  // get roles against frontend url
  // @Get('/roles-against-url')
  // getRolesAgainstURL(@Query('path') path: string) {
  //   console.log(path);
  //   return this.permissionService.getRolesAgainstURL(path);
  // }

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
