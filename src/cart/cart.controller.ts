/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  ValidationPipe,
  Get,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/addCartItem.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  // Add an item to cart
  @Post('items')
  async addItem(
    @Req() req,
    @Body(new ValidationPipe({ transform: true })) dto: AddCartItemDto,
  ) {
    console.log('addtocart');
    return this.cartService.addItemToCart(req?.user?.userId, dto);
  }

  // Get cart
  @Get('items')
  getCartItems(@Req() req) {
    return this.cartService.getCartItems(req.user.userId);
  }

  // Add an item to cart
  @Get('count')
  async countCartItems(@Req() req) {
    console.log('found');
    return this.cartService.countCartItems(req.user.userId);
  }
}
