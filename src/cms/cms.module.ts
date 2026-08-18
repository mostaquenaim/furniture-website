import { Module } from '@nestjs/common';
import { CmsController } from './cms.controller';
import { CmsService } from './cms.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CartService } from 'src/cart/cart.service';
import { OrderService } from 'src/order/order.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { BullModule } from '@nestjs/bull';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { CourierService } from 'src/courier/services/courier.service';
import { HttpModule } from '@nestjs/axios';
import { SeasonalCategoryService } from 'src/seasonal-category/seasonal-category.service';
import { HomepageGalleryService } from 'src/homepage-gallery/homepage-gallery.service';
import { BroadBannerService } from 'src/banner/banner.service';
import { StockLedgerService } from 'src/inventory/stock-ledger.service';
import { StockEventsModule } from 'src/realtime/stock-events.module';
import { CustomerOrderEventsModule } from 'src/realtime/customer-order-events.module';
import { PaymentMethodConfigModule } from 'src/payment-method-config/payment-method-config.module';
import { SettingsModule } from 'src/settings/settings.module';
import { ReservationModule } from 'src/reservation/reservation.module';
import { OrderStatusService } from 'src/order-status/order-status.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'notification' }),
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
    StockEventsModule,
    CustomerOrderEventsModule,
    PaymentMethodConfigModule,
    SettingsModule,
    ReservationModule,
  ],
  controllers: [CmsController],
  providers: [
    ActivityLogService,
    CmsService,
    PrismaService,
    CartService,
    OrderService,
    NotificationsService,
    CourierService,
    SeasonalCategoryService,
    HomepageGalleryService,
    BroadBannerService,
    StockLedgerService,
    OrderStatusService,
  ],
})
export class CmsModule {}
