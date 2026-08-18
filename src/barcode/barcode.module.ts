// src/barcode/barcode.module.ts
import { Module } from '@nestjs/common';
import { BarcodeController } from './barcode.controller';
import { BarcodeService } from './barcode.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { PermissionService } from 'src/permission/permission.service';
import { ActivityLogService } from 'src/activity-log/activity-log.service';

@Module({
  imports: [PrismaModule],
  controllers: [BarcodeController],
  providers: [
    BarcodeService,
    PrismaService,
    PermissionService,
    ActivityLogService,
  ],
  exports: [BarcodeService],
})
export class BarcodeModule {}
