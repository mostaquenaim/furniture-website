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
import { CouponModule } from './coupon/coupon.module';
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
import { NotificationsModule } from './notifications/notifications.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { SettingsModule } from './settings/settings.module';
import { RolesModule } from './roles/roles.module';
import { PermissionModule } from './permission/permission.module';
import { CategoryModule } from './category/category.module';
import { AdminModule } from './admin/admin.module';
import { ProductModule } from './product/product.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    PrismaModule,
    SubcategoryModule,
    UserModule,
    OrderModule,
    PaymentModule,
    WishlistModule,
    ReviewModule,
    CouponModule,
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
    NotificationsModule,
    RecommendationsModule,
    SettingsModule,
    RolesModule,
    PermissionModule,
    CategoryModule,
    AdminModule,
    ProductModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
