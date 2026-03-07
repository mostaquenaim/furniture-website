import { Module } from '@nestjs/common';
import { CmsController } from './cms.controller';
import { CmsService } from './cms.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CartService } from 'src/cart/cart.service';
import { OrderService } from 'src/order/order.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { BullModule } from '@nestjs/bull';
import { ActivityLogService } from 'src/activity-log/activity-log.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'notification' })],
  controllers: [CmsController],
  providers: [
    ActivityLogService,
    CmsService,
    PrismaService,
    CartService,
    OrderService,
    NotificationsService,
  ],
})
export class CmsModule {}
