// src/piece/piece.module.ts
import { Module } from '@nestjs/common';
import { PieceController } from './piece.controller';
import { PieceService } from './piece.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { PermissionService } from 'src/permission/permission.service';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { InventoryModule } from 'src/inventory/inventory.module';
import { StockEventsModule } from 'src/realtime/stock-events.module';
import { BarcodeModule } from 'src/barcode/barcode.module';

@Module({
  imports: [PrismaModule, InventoryModule, StockEventsModule, BarcodeModule],
  controllers: [PieceController],
  providers: [PieceService, PrismaService, PermissionService, ActivityLogService],
  exports: [PieceService],
})
export class PieceModule {}
