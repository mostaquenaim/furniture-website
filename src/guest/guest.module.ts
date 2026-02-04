import { Module } from '@nestjs/common';
import { GuestController } from './guest.controller';
import { GuestService } from './guest.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CartService } from 'src/cart/cart.service';

@Module({
  controllers: [GuestController],
  providers: [GuestService, PrismaService, CartService],
})
export class GuestModule {}
