import { Module } from '@nestjs/common';
import { FeaturedCategoryController } from './featured-category.controller';
import { FeaturedCategoryService } from './featured-category.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { PermissionService } from '../permission/permission.service';

@Module({
  controllers: [FeaturedCategoryController],
  providers: [
    FeaturedCategoryService,
    PrismaService,
    ActivityLogService,
    PermissionService,
  ],
  exports: [FeaturedCategoryService],
})
export class FeaturedCategoryModule {}
