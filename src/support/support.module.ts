import { Module } from '@nestjs/common';
import { SupportController } from './support.controller';
import { AdminTicketController } from './admin-ticket.controller';
import { SupportService } from './support.service';
import { AdminTicketService } from './admin-ticket.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { PermissionService } from 'src/permission/permission.service';
import { NotificationModule } from 'src/notifications/notifications.module';

@Module({
  imports: [NotificationModule],
  controllers: [SupportController, AdminTicketController],
  providers: [
    SupportService,
    AdminTicketService,
    PrismaService,
    ActivityLogService,
    PermissionService,
  ],
})
export class SupportModule {}
