import { Module } from '@nestjs/common';
import { AdminNotificationsController } from './admin-notifications.controller';
import { AdminNotificationsService } from './admin-notifications.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PermissionService } from 'src/permission/permission.service';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { StockEventsModule } from 'src/realtime/stock-events.module';

@Module({
  imports: [PrismaModule, StockEventsModule],
  controllers: [AdminNotificationsController],
  providers: [AdminNotificationsService, PermissionService, ActivityLogService],
  exports: [AdminNotificationsService],
})
export class AdminNotificationsModule {}
