// src/order-status/order-status.module.ts
import { Module } from '@nestjs/common';
import { OrderStatusService } from './order-status.service';
import { StockLedgerService } from '../inventory/stock-ledger.service';
import { ReservationModule } from '../reservation/reservation.module';

@Module({
  imports: [ReservationModule],
  providers: [OrderStatusService, StockLedgerService],
  exports: [OrderStatusService],
})
export class OrderStatusModule {}
