import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { ConfigService } from '@nestjs/config';
import { PaymentMethodConfigModule } from 'src/payment-method-config/payment-method-config.module';
import { AdminNotificationsModule } from 'src/admin-notifications/admin-notifications.module';

@Module({
  imports: [PaymentMethodConfigModule, AdminNotificationsModule],
  controllers: [PaymentController],
  providers: [PaymentService, ConfigService],
  exports: [PaymentService],
})
export class PaymentModule {}
