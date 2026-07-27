import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthModule } from 'src/auth/auth.module';
import { BullModule } from '@nestjs/bull';
import { PermissionService } from 'src/permission/permission.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'notification' }), AuthModule],
  providers: [UserService, PrismaService, PermissionService],
  controllers: [UserController],
})
export class UserModule {}
