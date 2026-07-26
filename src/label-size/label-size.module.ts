// src/label-size/label-size.module.ts
import { Module } from '@nestjs/common';
import { LabelSizeController } from './label-size.controller';
import { LabelSizeService } from './label-size.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { PermissionService } from 'src/permission/permission.service';

@Module({
  imports: [PrismaModule],
  controllers: [LabelSizeController],
  providers: [LabelSizeService, PrismaService, PermissionService],
  exports: [LabelSizeService],
})
export class LabelSizeModule {}
