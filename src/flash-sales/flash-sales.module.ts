import { Module } from '@nestjs/common';
import { FlashSalesController } from './flash-sales.controller';
import { FlashSalesService } from './flash-sales.service';

@Module({
  controllers: [FlashSalesController],
  providers: [FlashSalesService],
})
export class FlashSalesModule {}
