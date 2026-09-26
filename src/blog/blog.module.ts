import { Module } from '@nestjs/common';
import { BlogsController } from './blog.controller';
import { BlogsService } from './blog.service';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { PermissionService } from 'src/permission/permission.service';

@Module({
  controllers: [BlogsController],
  providers: [BlogsService, ActivityLogService, PermissionService],
})
export class BlogsModule {}
