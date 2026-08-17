import { Module } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { PermissionService } from 'src/permission/permission.service';

@Module({
  providers: [RolesService, PrismaService, PermissionService],
  controllers: [RolesController]
})
export class RolesModule {}
