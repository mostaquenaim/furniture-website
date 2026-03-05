import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { PrismaModule } from './prisma/prisma.module';
import { SubcategoryModule } from './subcategory/subcategory.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { OrderModule } from './order/order.module';
import { PaymentModule } from './payment/payment.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { ReviewModule } from './review/review.module';
import { FlashSalesModule } from './flash-sales/flash-sales.module';
import { CmsModule } from './cms/cms.module';
import { InventoryModule } from './inventory/inventory.module';
import { ShippingModule } from './shipping/shipping.module';
import { FaqModule } from './faq/faq.module';
import { ContactModule } from './contact/contact.module';
import { SeoModule } from './seo/seo.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { LogsModule } from './logdetails/logs.module';
import { BlogsModule } from './blog/blog.module';
import { NotificationModule } from './notifications/notifications.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { SettingsModule } from './settings/settings.module';
import { RolesModule } from './roles/roles.module';
import { PermissionModule } from './permission/permission.module';
import { CategoryModule } from './category/category.module';
import { AdminModule } from './admin/admin.module';
import { ProductModule } from './product/product.module';
import { MaterialModule } from './material/material.module';
import { CartModule } from './cart/cart.module';
import { GuestModule } from './guest/guest.module';
import { SupportModule } from './support/support.module';
import { BullModule } from '@nestjs/bull';
import { BarcodeModule } from './barcode/barcode.module';
import { ActivityLogModule } from './activity-log/activity-log.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    BullModule.forRoot({
      redis: {
        host: 'localhost',
        port: 6379,
      },
    }),

    AuthModule,
    PrismaModule,
    SubcategoryModule,
    UserModule,
    OrderModule,
    PaymentModule,
    WishlistModule,
    ReviewModule,
    FlashSalesModule,
    BlogsModule,
    CmsModule,
    InventoryModule,
    ShippingModule,
    FaqModule,
    ContactModule,
    SeoModule,
    AnalyticsModule,
    LogsModule,
    NotificationModule,
    RecommendationsModule,
    SettingsModule,
    RolesModule,
    PermissionModule,
    CategoryModule,
    AdminModule,
    ProductModule,
    MaterialModule,
    CartModule,
    GuestModule,
    SupportModule,
    BarcodeModule,
    ActivityLogModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
