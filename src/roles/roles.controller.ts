import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { UserRole } from '@prisma/client';

// NOTE: this controller's data source (RolesService) is an in-memory mock
// array unrelated to the real RolePermission-table-backed permission system
// (see src/permission and src/roles' sibling src/auth/roles.enum.ts /
// src/permission/action.enum.ts). It isn't called by the frontend today.
// Locked down to SUPERADMIN — same as admin-user.controller.ts — because it
// was previously reachable with zero auth of any kind.
@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN)
export class RolesController {
  constructor(private readonly service: RolesService) {}

  @Get() getAll() {
    return this.service.getAll();
  }

  @Post()
  createRole(@Body('name') name: string) {
    return this.service.createRole(name);
  }

  @Put(':id')
  updateRole(@Param('id') id: string, @Body('name') name: string) {
    return this.service.updateRole(id, name);
  }

  @Delete(':id')
  deleteRole(@Param('id') id: string) {
    return this.service.deleteRole(id);
  }

  @Get(':id/permissions')
  getPermissions(@Param('id') id: string) {
    return this.service.getPermissions(id);
  }

  @Post(':id/permissions')
  assignPermissions(
    @Param('id') id: string,
    @Body('permissions') permissions: string[],
  ) {
    return this.service.assignPermissions(id, permissions);
  }
}
