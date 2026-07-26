import { Module } from '@nestjs/common';
import { RefundService } from './refund.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { NotificationModule } from '../notifications/notifications.module';
import { StockEventsModule } from '../realtime/stock-events.module';
import { PaymentModule } from '../payment/payment.module';
import { StockLedgerService } from '../inventory/stock-ledger.service';
import { ReservationModule } from '../reservation/reservation.module';

@Module({
  imports: [
    NotificationModule,
    StockEventsModule,
    PaymentModule,
    ReservationModule,
  ],
  providers: [
    RefundService,
    PrismaService,
    ActivityLogService,
    StockLedgerService,
  ],
  exports: [RefundService],
})
export class RefundModule {}
