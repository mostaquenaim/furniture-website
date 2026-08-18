import { Module } from '@nestjs/common';
import { FlashSalesController } from './flash-sales.controller';
import { FlashSalesService } from './flash-sales.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { PermissionService } from '../permission/permission.service';

@Module({
  controllers: [FlashSalesController],
  providers: [
    FlashSalesService,
    PrismaService,
    ActivityLogService,
    PermissionService,
  ],
  exports: [FlashSalesService],
})
export class FlashSalesModule {}
