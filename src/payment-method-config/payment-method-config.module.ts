import { Module } from '@nestjs/common';
import { PaymentMethodConfigService } from './payment-method-config.service';
import { PaymentMethodConfigController } from './payment-method-config.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { PermissionService } from 'src/permission/permission.service';
import { ActivityLogService } from 'src/activity-log/activity-log.service';

@Module({
  controllers: [PaymentMethodConfigController],
  providers: [
    PaymentMethodConfigService,
    PrismaService,
    PermissionService,
    ActivityLogService,
  ],
  exports: [PaymentMethodConfigService],
})
export class PaymentMethodConfigModule {}
