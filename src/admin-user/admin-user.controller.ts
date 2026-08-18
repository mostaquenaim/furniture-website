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
  Req,
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
  createAdminUser(@Body() dto: CreateAdminUserDto, @Req() req: any) {
    return this.adminUsersService.createAdminUser(dto, req?.user?.userId);
  }

  @Patch(':id/role')
  @Roles(UserRole.SUPERADMIN)
  changeRole(
    @Param('id', ParseIntPipe) id: number,
    @Body('role') role: UserRole,
    @Req() req: any,
  ) {
    return this.adminUsersService.changeRole(id, role, req?.user?.userId);
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPERADMIN)
  toggleStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('isActive') isActive: boolean,
    @Req() req: any,
  ) {
    return this.adminUsersService.toggleStatus(
      id,
      isActive,
      req?.user?.userId,
    );
  }

  @Post(':id/reset-password')
  @Roles(UserRole.SUPERADMIN)
  resetPassword(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.adminUsersService.resetPassword(id, req?.user?.userId);
  }

  @Delete(':id')
  @Roles(UserRole.SUPERADMIN)
  deleteUser(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.adminUsersService.deleteUser(id, req?.user?.userId);
  }
}
