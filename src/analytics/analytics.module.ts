import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { DashboardModule } from 'src/dashboard/dashboard.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { PermissionService } from 'src/permission/permission.service';

@Module({
  imports: [DashboardModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, PrismaService, PermissionService],
})
export class AnalyticsModule {}
