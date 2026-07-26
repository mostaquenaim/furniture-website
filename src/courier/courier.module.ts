/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
// src/courier/courier.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CourierController } from './courier.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { RedxProvider } from './providers/redx.provider';
import { PaperflyProvider } from './providers/paperfly.provider';
import { PathaoProvider } from './providers/pathao.provider';
import { PrismaService } from 'src/prisma/prisma.service';
import { PermissionService } from 'src/permission/permission.service';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { SteadfastProvider } from './providers/steadfast.provider';
import { CourierWebhookController } from './courier-webhook.controller';
import { CourierWebhookService } from './services/courier-webhook.service';
import { CourierService } from './services/courier.service';
import { ReservationModule } from 'src/reservation/reservation.module';
import { OrderStatusModule } from 'src/order-status/order-status.module';

// Providers

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
    PrismaModule,
    ConfigModule,
    ReservationModule,
    OrderStatusModule,
  ],
  controllers: [CourierController, CourierWebhookController],
  providers: [
    CourierService,
    SteadfastProvider,
    RedxProvider,
    PaperflyProvider,
    PathaoProvider,
    PrismaService,
    PermissionService,
    ActivityLogService,
    CourierWebhookService,
  ],
  exports: [CourierService],
})
export class CourierModule {}
