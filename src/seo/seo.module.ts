import { Module } from '@nestjs/common';
import { SeoController } from './seo.controller';
import { SeoService } from './seo.service';
import { PermissionService } from 'src/permission/permission.service';
import { ActivityLogService } from 'src/activity-log/activity-log.service';

@Module({
  controllers: [SeoController],
  providers: [SeoService, PermissionService, ActivityLogService],
})
export class SeoModule {}
