import { Module } from '@nestjs/common';
import { BannerController } from './banner.controller';
import { BroadBannerService } from './banner.service';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { PermissionService } from 'src/permission/permission.service';

@Module({
  controllers: [BannerController],
  providers: [BroadBannerService, ActivityLogService, PermissionService],
})
export class BannerModule {}
