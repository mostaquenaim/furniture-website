import { Module } from '@nestjs/common';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { PermissionService } from 'src/permission/permission.service';

@Module({
  controllers: [ReviewController],
  providers: [
    ReviewService,
    PrismaService,
    ActivityLogService,
    PermissionService,
  ],
})
export class ReviewModule {}
