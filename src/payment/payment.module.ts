import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [PaymentController],
  providers: [PaymentService, ConfigService, PrismaService],
})
export class PaymentModule {}
