import { Module } from '@nestjs/common';
import { UrgencyBannerController } from './urgency-banner.controller';
import { UrgencyBannerService } from './urgency-banner.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { PermissionService } from '../permission/permission.service';

@Module({
  controllers: [UrgencyBannerController],
  providers: [UrgencyBannerService, ActivityLogService, PermissionService],
  exports: [UrgencyBannerService],
})
export class UrgencyBannerModule {}
