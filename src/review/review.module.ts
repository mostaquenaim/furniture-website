import { Module } from '@nestjs/common';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { PermissionService } from 'src/permission/permission.service';

@Module({
  controllers: [ReviewController],
  providers: [ReviewService, ActivityLogService, PermissionService],
})
export class ReviewModule {}
