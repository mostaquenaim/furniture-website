import { Module } from '@nestjs/common';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { PermissionService } from 'src/permission/permission.service';

@Module({
  controllers: [CategoryController],
  providers: [CategoryService, PrismaService, PermissionService],
})
export class CategoryModule {}
