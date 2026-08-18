import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentMethodConfigModule } from 'src/payment-method-config/payment-method-config.module';

@Module({
  imports: [PaymentMethodConfigModule],
  controllers: [PaymentController],
  providers: [PaymentService, ConfigService, PrismaService],
  exports: [PaymentService],
})
export class PaymentModule {}
