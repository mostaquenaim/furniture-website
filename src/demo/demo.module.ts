import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PermissionService } from 'src/permission/permission.service';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { DemoGenerateController } from './demo-generate.controller';
import { DemoResetService } from './demo-reset.service';

@Module({
  controllers: [DemoGenerateController],
  // RolesGuard (used on DemoGenerateController) needs PermissionService,
  // which in turn needs ActivityLogService — this module follows the same
  // "each module declares its own transitive providers" convention as
  // AdminModule rather than importing PermissionModule/ActivityLogModule.
  providers: [
    DemoResetService,
    PrismaService,
    PermissionService,
    ActivityLogService,
  ],
})
export class DemoModule {}
