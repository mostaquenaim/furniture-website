import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { CategoryService } from 'src/category/category.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { PermissionService } from 'src/permission/permission.service';
import { CmsService } from 'src/cms/cms.service';
import { ProductService } from 'src/product/product.service';
import { BlogsService } from 'src/blog/blog.service';
import { ActivityLogService } from 'src/activity-log/activity-log.service';

@Module({
  controllers: [AdminController],
  providers: [
    AdminService,
    BlogsService,
    CategoryService,
    PrismaService,
    PermissionService,
    CmsService,
    ProductService,
    ActivityLogService,
  ],
})
export class AdminModule {}
