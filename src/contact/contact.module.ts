import { Module } from '@nestjs/common';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';
import { PermissionService } from 'src/permission/permission.service';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { AdminNotificationsModule } from 'src/admin-notifications/admin-notifications.module';
import { NotificationModule } from 'src/notifications/notifications.module';

@Module({
  imports: [AdminNotificationsModule, NotificationModule],
  controllers: [ContactController],
  providers: [ContactService, PermissionService, ActivityLogService],
})
export class ContactModule {}
