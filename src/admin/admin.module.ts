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
import { CourierService } from 'src/courier/services/courier.service';
import { HttpModule } from '@nestjs/axios';
import { PathaoLocationSyncService } from 'src/courier/services/pathao-location-sync.service';
import { SeasonalCategoryService } from 'src/seasonal-category/seasonal-category.service';
import { StockLedgerService } from 'src/inventory/stock-ledger.service';
import { StockEventsModule } from 'src/realtime/stock-events.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'notification' }),
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
    StockEventsModule,
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
    PathaoLocationSyncService,
    SeasonalCategoryService,
    StockLedgerService,
  ],
})
export class AdminModule {}
