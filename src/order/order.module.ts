import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationModule } from 'src/notifications/notifications.module';

@Module({
  imports: [NotificationModule],
  providers: [OrderService, PrismaService],
  controllers: [OrderController],
})
export class OrderModule {}
