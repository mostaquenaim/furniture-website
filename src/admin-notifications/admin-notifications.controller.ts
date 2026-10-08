// src/admin-notifications/admin-notifications.controller.ts
import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminNotificationsService } from './admin-notifications.service';

// Same trust boundary as the /inventory websocket namespace this pairs with:
// any staff role can read and acknowledge notifications, no fine-grained
// permission needed. CUSTOMER is left out of the allowlist on purpose: a
// customer JWT is valid for JwtAuthGuard, and these carry order details.
@Controller('admin-notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.SUPERADMIN,
  UserRole.PRODUCTMANAGER,
  UserRole.ORDERMANAGER,
  UserRole.INVENTORYMANAGER,
  UserRole.SUPPORT,
)
export class AdminNotificationsController {
  constructor(private readonly service: AdminNotificationsService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get('badge-counts')
  badgeCounts() {
    return this.service.getBadgeCounts();
  }

  @Post(':id/read')
  markRead(@Param('id', ParseIntPipe) id: number) {
    return this.service.markRead(id);
  }

  @Post('read-all')
  markAllRead() {
    return this.service.markAllRead();
  }
}
