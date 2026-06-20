import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { StockLedgerService } from './stock-ledger.service';
import { LowStockAlertService } from './low-stock-alert.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { PermissionService } from 'src/permission/permission.service';
import { StockEventsModule } from 'src/realtime/stock-events.module';
import { NotificationModule } from 'src/notifications/notifications.module';

@Module({
  imports: [StockEventsModule, NotificationModule],
  controllers: [InventoryController],
  providers: [
    InventoryService,
    StockLedgerService,
    LowStockAlertService,
    PrismaService,
    ActivityLogService,
    PermissionService,
  ],
  exports: [StockLedgerService],
})
export class InventoryModule {}
