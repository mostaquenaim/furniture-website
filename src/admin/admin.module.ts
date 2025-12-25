import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { CategoryService } from 'src/category/category.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { PermissionService } from 'src/permission/permission.service';
import { CmsService } from 'src/cms/cms.service';

@Module({
  controllers: [AdminController],
  providers: [
    AdminService,
    CategoryService,
    PrismaService,
    PermissionService,
    CmsService,
  ],
})
export class AdminModule {}
