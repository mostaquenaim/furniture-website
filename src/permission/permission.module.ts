import { Module } from '@nestjs/common';
import { PermissionController } from './permission.controller';
import { PermissionService } from './permission.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActivityLogService } from 'src/activity-log/activity-log.service';

@Module({
  controllers: [PermissionController],
  providers: [PermissionService, PrismaService, ActivityLogService],
})
export class PermissionModule {}
