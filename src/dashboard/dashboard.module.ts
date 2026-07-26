import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { PermissionService } from 'src/permission/permission.service';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService, PrismaService, PermissionService],
  exports: [DashboardService],
})
export class DashboardModule {}
