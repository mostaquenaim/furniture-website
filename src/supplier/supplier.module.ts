// src/supplier/supplier.module.ts
import { Module } from '@nestjs/common';
import { SupplierController } from './supplier.controller';
import { SupplierService } from './supplier.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { PermissionService } from 'src/permission/permission.service';
import { ActivityLogService } from 'src/activity-log/activity-log.service';

@Module({
  imports: [PrismaModule],
  controllers: [SupplierController],
  providers: [SupplierService, PrismaService, PermissionService, ActivityLogService],
  exports: [SupplierService],
})
export class SupplierModule {}
