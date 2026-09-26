import { Module } from '@nestjs/common';
import { FlashSalesController } from './flash-sales.controller';
import { FlashSalesService } from './flash-sales.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { PermissionService } from '../permission/permission.service';

@Module({
  controllers: [FlashSalesController],
  providers: [FlashSalesService, ActivityLogService, PermissionService],
  exports: [FlashSalesService],
})
export class FlashSalesModule {}
