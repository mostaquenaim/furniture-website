import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthModule } from 'src/auth/auth.module';
import { BullModule } from '@nestjs/bull';
import { PermissionService } from 'src/permission/permission.service';
import { ActivityLogService } from 'src/activity-log/activity-log.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'notification' }), AuthModule],
  providers: [
    UserService,
    PrismaService,
    PermissionService,
    ActivityLogService,
  ],
  controllers: [UserController],
})
export class UserModule {}
