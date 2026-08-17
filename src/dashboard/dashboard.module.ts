import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { PermissionService } from 'src/permission/permission.service';
import { ActivityLogService } from 'src/activity-log/activity-log.service';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService, PrismaService, PermissionService, ActivityLogService],
  exports: [DashboardService],
})
export class DashboardModule {}
