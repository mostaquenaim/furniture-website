import { Module } from '@nestjs/common';
import { AdminUsersController } from './admin-user.controller';
import { AdminUsersService } from './admin-user.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { PermissionService } from 'src/permission/permission.service';
import { ActivityLogService } from 'src/activity-log/activity-log.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminUsersController],
  providers: [
    AdminUsersService,
    PrismaService,
    PermissionService,
    ActivityLogService,
  ],
})
export class AdminUserModule {}
