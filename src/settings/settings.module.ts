import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { AppSettingsService } from './app-settings.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentMethodConfigModule } from 'src/payment-method-config/payment-method-config.module';
import { PermissionService } from 'src/permission/permission.service';

@Module({
  imports: [PaymentMethodConfigModule],
  providers: [
    SettingsService,
    AppSettingsService,
    PrismaService,
    PermissionService,
  ],
  controllers: [SettingsController],
  exports: [AppSettingsService],
})
export class SettingsModule {}
