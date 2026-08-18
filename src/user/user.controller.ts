/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  Post,
  UseGuards,
  Req,
} from '@nestjs/common';

import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { SuspendUserDto } from './dto/suspend-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthService } from 'src/auth/auth.service';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { SkipPermission } from 'src/permission/skip-permission.decorator';
import { UserRole } from '@prisma/client';

const STAFF_READ_ROLES = [
  UserRole.SUPERADMIN,
  UserRole.SUPPORT,
  UserRole.ORDERMANAGER,
];

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  @Roles(...STAFF_READ_ROLES)
  findAll() {
    return this.userService.findAll();
  }

  @Put('update')
  @SkipPermission()
  update(@Req() req, @Body() dto: UpdateUserDto) {
    return this.authService.update(req?.user?.userId, dto);
  }

  @Get(':id')
  @Roles(...STAFF_READ_ROLES)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findOne(id);
  }

  @Delete(':id')
  @Roles(UserRole.SUPERADMIN)
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.userService.remove(id, req?.user?.userId);
  }

  @Get(':id/orders')
  @Roles(...STAFF_READ_ROLES)
  getOrders(@Param('id', ParseIntPipe) id: number) {
    return this.userService.getOrders(id);
  }

  @Get(':id/wishlist')
  @Roles(...STAFF_READ_ROLES)
  getWishlist(@Param('id', ParseIntPipe) id: number) {
    return this.userService.getWishlist(id);
  }

  @Post('suspend')
  @Roles(UserRole.SUPERADMIN)
  suspendUser(@Body() dto: SuspendUserDto, @Req() req: any) {
    return this.userService.suspendUser(dto, req?.user?.userId);
  }
}
