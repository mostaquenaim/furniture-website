import { Module } from '@nestjs/common';
import { SeasonalCategoryController } from './seasonal-category.controller';
import { SeasonalCategoryService } from './seasonal-category.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { PermissionService } from 'src/permission/permission.service';
import { ActivityLogService } from 'src/activity-log/activity-log.service';

@Module({
  controllers: [SeasonalCategoryController],
  providers: [SeasonalCategoryService, PrismaService, PermissionService, ActivityLogService],
})
export class SeasonalCategoryModule {}
