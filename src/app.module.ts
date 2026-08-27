import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { OrderModule } from './order/order.module';
import { PaymentModule } from './payment/payment.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { ReviewModule } from './review/review.module';
import { FlashSalesModule } from './flash-sales/flash-sales.module';
import { CmsModule } from './cms/cms.module';
import { InventoryModule } from './inventory/inventory.module';
import { FaqModule } from './faq/faq.module';
import { ContactModule } from './contact/contact.module';
import { SeoModule } from './seo/seo.module';
import { BlogsModule } from './blog/blog.module';
import { NotificationModule } from './notifications/notifications.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { SettingsModule } from './settings/settings.module';
import { RolesModule } from './roles/roles.module';
import { PermissionModule } from './permission/permission.module';
import { CategoryModule } from './category/category.module';
import { AdminModule } from './admin/admin.module';
import { ProductModule } from './product/product.module';
import { CartModule } from './cart/cart.module';
import { GuestModule } from './guest/guest.module';
import { SupportModule } from './support/support.module';
import { BullModule } from '@nestjs/bull';
import { getRedisConnection } from './common/utils/redis.utils';
import { BarcodeModule } from './barcode/barcode.module';
import { ActivityLogModule } from './activity-log/activity-log.module';
import { CourierModule } from './courier/courier.module';
import { AdminUserModule } from './admin-user/admin-user.module';
import { CompanyModule } from './company/company.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SeasonalCategoryModule } from './seasonal-category/seasonal-category.module';
import { HomepageGalleryModule } from './homepage-gallery/homepage-gallery.module';
import { BannerModule } from './banner/banner.module';
import { PaymentMethodConfigModule } from './payment-method-config/payment-method-config.module';
import { FeaturedCategoryModule } from './featured-category/featured-category.module';
import { UrgencyBannerModule } from './urgency-banner/urgency-banner.module';
import { SupplierModule } from './supplier/supplier.module';
import { PieceModule } from './piece/piece.module';
import { ReservationModule } from './reservation/reservation.module';
import { LabelSizeModule } from './label-size/label-size.module';
import { AdminNotificationsModule } from './admin-notifications/admin-notifications.module';
import { ApiClientModule } from './api-client/api-client.module';
import { PartnerInventoryModule } from './partner-inventory/partner-inventory.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    ScheduleModule.forRoot(),

    BullModule.forRoot({
      redis: getRedisConnection(),
    }),

    AuthModule,
    PrismaModule,
    UserModule,
    OrderModule,
    PaymentModule,
    WishlistModule,
    ReviewModule,
    FlashSalesModule,
    BlogsModule,
    CmsModule,
    InventoryModule,
    FaqModule,
    ContactModule,
    SeoModule,
    NotificationModule,
    RecommendationsModule,
    SettingsModule,
    RolesModule,
    PermissionModule,
    CategoryModule,
    AdminModule,
    ProductModule,
    CartModule,
    GuestModule,
    SupportModule,
    BarcodeModule,
    ActivityLogModule,
    CourierModule,
    AdminUserModule,
    CompanyModule,
    DashboardModule,
    SeasonalCategoryModule,
    HomepageGalleryModule,
    BannerModule,
    PaymentMethodConfigModule,
    FeaturedCategoryModule,
    UrgencyBannerModule,
    SupplierModule,
    PieceModule,
    ReservationModule,
    LabelSizeModule,
    AdminNotificationsModule,
    ApiClientModule,
    PartnerInventoryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
