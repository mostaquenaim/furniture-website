import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationModule } from 'src/notifications/notifications.module';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { BullModule } from '@nestjs/bull';
import { StockLedgerService } from 'src/inventory/stock-ledger.service';
import { StockEventsModule } from 'src/realtime/stock-events.module';
import { PaymentMethodConfigModule } from 'src/payment-method-config/payment-method-config.module';
import { RefundModule } from 'src/refund/refund.module';
import { ReservationModule } from 'src/reservation/reservation.module';

@Module({
  imports: [
    NotificationModule,
    BullModule.registerQueue({ name: 'notification' }),
    StockEventsModule,
    PaymentMethodConfigModule,
    RefundModule,
    ReservationModule,
  ],
  providers: [
    OrderService,
    PrismaService,
    ActivityLogService,
    StockLedgerService,
  ],
  controllers: [OrderController],
})
export class OrderModule {}
