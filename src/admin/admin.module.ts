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
import { OrderService } from 'src/order/order.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { BullModule } from '@nestjs/bull';
import { ReviewService } from 'src/review/review.service';
import { CourierService } from 'src/courier/courier.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'notification' }),
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
  ],
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
    OrderService,
    NotificationsService,
    ReviewService,
    CourierService,
  ],
})
export class AdminModule {}
