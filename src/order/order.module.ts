import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationModule } from 'src/notifications/notifications.module';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { BullModule } from '@nestjs/bull';

@Module({
  imports: [
    NotificationModule,
    BullModule.registerQueue({ name: 'notification' }),
  ],
  providers: [OrderService, PrismaService, ActivityLogService],
  controllers: [OrderController],
})
export class OrderModule {}
