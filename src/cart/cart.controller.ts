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
  Query,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/addCartItem.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  // Add an item to cart
  @UseGuards(JwtAuthGuard)
  @Post('items')
  async addItem(
    @Req() req,
    @Body(new ValidationPipe({ transform: true })) dto: AddCartItemDto,
  ) {
    console.log('addtocart', req?.user?.userId, dto);
    return this.cartService.addItemToCart(req?.user?.userId, dto);
  }

  // Get cart
  @Get('items')
  getCartItems(
    @Req() req,
    @Query('productId') productId?: string,
    @Query('colorId') colorId?: string,
    @Query('sizeId') sizeId?: string,
  ) {
    return this.cartService.getCartItems(req.user.userId, {
      productId: productId ? +productId : undefined,
      colorId: colorId ? +colorId : undefined,
      sizeId: sizeId ? +sizeId : undefined,
    });
  }

  // Add an item to cart
  @UseGuards(JwtAuthGuard)
  @Get('count')
  async countCartItems(@Req() req) {
    console.log('found');
    return this.cartService.countCartItems(req.user.userId);
  }
}
