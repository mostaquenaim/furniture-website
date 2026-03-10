import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationModule } from 'src/notifications/notifications.module';
import { ActivityLogService } from 'src/activity-log/activity-log.service';

@Module({
  imports: [NotificationModule],
  providers: [OrderService, PrismaService, ActivityLogService],
  controllers: [OrderController],
})
export class OrderModule {}
