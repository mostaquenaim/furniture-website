// src/admin-users/admin-users.controller.ts
import {
  Controller,
  Get,
  UseGuards,
  Post,
  Body,
  Patch,
  Param,
  ParseIntPipe,
  Delete,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UserRole } from '@prisma/client';
import { AdminUsersService } from './admin-user.service';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @Roles(UserRole.SUPERADMIN)
  getAdminUsers() {
    return this.adminUsersService.getAdminUsers();
  }

  @Post()
  @Roles(UserRole.SUPERADMIN)
  createAdminUser(@Body() dto: CreateAdminUserDto) {
    return this.adminUsersService.createAdminUser(dto);
  }

  @Patch(':id/role')
  @Roles(UserRole.SUPERADMIN)
  changeRole(
    @Param('id', ParseIntPipe) id: number,
    @Body('role') role: UserRole,
  ) {
    return this.adminUsersService.changeRole(id, role);
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPERADMIN)
  toggleStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('isActive') isActive: boolean,
  ) {
    return this.adminUsersService.toggleStatus(id, isActive);
  }

  @Post(':id/reset-password')
  @Roles(UserRole.SUPERADMIN)
  resetPassword(@Param('id', ParseIntPipe) id: number) {
    return this.adminUsersService.resetPassword(id);
  }

  @Delete(':id')
  @Roles(UserRole.SUPERADMIN)
  deleteUser(@Param('id', ParseIntPipe) id: number) {
    return this.adminUsersService.deleteUser(id);
  }
}
