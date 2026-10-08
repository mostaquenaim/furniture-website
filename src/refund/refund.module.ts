import { Module } from '@nestjs/common';
import { RefundService } from './refund.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { NotificationModule } from '../notifications/notifications.module';
import { StockEventsModule } from '../realtime/stock-events.module';
import { CustomerOrderEventsModule } from '../realtime/customer-order-events.module';
import { PaymentModule } from '../payment/payment.module';
import { StockLedgerService } from '../inventory/stock-ledger.service';
import { ReservationModule } from '../reservation/reservation.module';
import { AdminNotificationsModule } from '../admin-notifications/admin-notifications.module';

@Module({
  imports: [
    NotificationModule,
    StockEventsModule,
    CustomerOrderEventsModule,
    PaymentModule,
    ReservationModule,
    AdminNotificationsModule,
  ],
  providers: [RefundService, ActivityLogService, StockLedgerService],
  exports: [RefundService],
})
export class RefundModule {}
