// src/admin-notifications/admin-notifications.controller.ts
import { Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { SkipPermission } from 'src/permission/skip-permission.decorator';
import { AdminNotificationsService } from './admin-notifications.service';

// Same trust boundary as the /inventory websocket namespace this pairs with:
// any authenticated staff role can read and acknowledge notifications, no
// fine-grained permission needed (see SkipPermission usages on admin/profile,
// user/update, permission/mine for the established precedent).
@Controller('admin-notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminNotificationsController {
  constructor(private readonly service: AdminNotificationsService) {}

  @Get()
  @SkipPermission()
  list() {
    return this.service.list();
  }

  @Post(':id/read')
  @SkipPermission()
  markRead(@Param('id', ParseIntPipe) id: number) {
    return this.service.markRead(id);
  }

  @Post('read-all')
  @SkipPermission()
  markAllRead() {
    return this.service.markAllRead();
  }
}
