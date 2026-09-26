import { Module } from '@nestjs/common';
import { GuestController } from './guest.controller';
import { GuestService } from './guest.service';
import { CartService } from 'src/cart/cart.service';

@Module({
  controllers: [GuestController],
  providers: [GuestService, CartService],
})
export class GuestModule {}
