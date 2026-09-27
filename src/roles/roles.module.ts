import { Module } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { PermissionService } from 'src/permission/permission.service';
import { ActivityLogService } from 'src/activity-log/activity-log.service';

@Module({
  providers: [RolesService, PermissionService, ActivityLogService],
  controllers: [RolesController],
})
export class RolesModule {}
