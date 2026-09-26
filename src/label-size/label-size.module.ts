// src/label-size/label-size.module.ts
import { Module } from '@nestjs/common';
import { LabelSizeController } from './label-size.controller';
import { LabelSizeService } from './label-size.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PermissionService } from 'src/permission/permission.service';
import { ActivityLogService } from 'src/activity-log/activity-log.service';

@Module({
  imports: [PrismaModule],
  controllers: [LabelSizeController],
  providers: [LabelSizeService, PermissionService, ActivityLogService],
  exports: [LabelSizeService],
})
export class LabelSizeModule {}
