import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { DeliveryFeeService } from './services/delivery-fee.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
  ],
  providers: [DeliveryFeeService],
  exports: [DeliveryFeeService],
})
export class DeliveryFeeModule {}
