/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
// src/courier/courier.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CourierService } from './courier.service';
import { CourierController } from './courier.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { SteadfastCourierProvider } from './providers/steadfast.provider';
import { RedxProvider } from './providers/redx.provider';
import { PaperflyProvider } from './providers/paperfly.provider';
import { PathaoProvider } from './providers/pathao.provider';
import { PrismaService } from 'src/prisma/prisma.service';
import { PermissionService } from 'src/permission/permission.service';

// Providers

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
    PrismaModule,
    ConfigModule,
  ],
  controllers: [CourierController],
  providers: [
    CourierService,
    SteadfastCourierProvider,
    RedxProvider,
    PaperflyProvider,
    PathaoProvider,
    PrismaService,
    PermissionService,
  ],
  exports: [CourierService],
})
export class CourierModule {}
