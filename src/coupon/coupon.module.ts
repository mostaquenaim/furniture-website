import { Module } from '@nestjs/common';
import { CouponsController } from './coupon.controller';
import { CouponsService } from './coupon.service';

@Module({
  controllers: [CouponsController],
  providers: [CouponsService]
})
export class CouponModule {}