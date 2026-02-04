/* eslint-disable @typescript-eslint/no-unsafe-return */
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
  Patch,
  Param,
  ParseIntPipe,
  Delete,
  Headers,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/addCartItem.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  // Add an item to cart
  @Post('items')
  async addItem(
    @Req() req,
    @Body(new ValidationPipe({ transform: true })) dto: AddCartItemDto,
  ) {
    // console.log('addtocart', req?.user?.userId, dto);
    return this.cartService.addItemToCart(req?.user?.userId, dto);
  }

  // Get cart
  @Get('items')
  async getCartItems(
    @Req() req,
    @Query('productSlug') productSlug?: string,
    @Query('colorId') colorId?: string,
    @Query('sizeId') sizeId?: string,
    @Query('summary') isSummary?: boolean,
  ) {
    // console.log('cart items', req.user.userId);

    return await this.cartService.getCartItems(req.user.userId, null, {
      productSlug: productSlug ? productSlug : undefined,
      colorId: colorId ? +colorId : undefined,
      sizeId: sizeId ? +sizeId : undefined,
      isSummary: isSummary ? isSummary : undefined,
    });
  }

  // Add an item to cart
  @Get('count')
  async countCartItems(@Req() req) {
    console.log('found');
    return this.cartService.countCartItems(req.user.userId, null);
  }

  // apply coupon
  @Patch('apply-coupon/:cartId')
  async applyCoupon(
    @Param('cartId', ParseIntPipe) cartId: number,
    @Body('code') code: string,
    @Req() req: any,
  ) {
    return this.cartService.applyCoupon(req.user.id, null, cartId, code);
  }

  // update cart item quantity
  @Patch('items/:id')
  async updateCartItemQuantity(
    @Param('id', ParseIntPipe) id: number,
    @Body('quantity', ParseIntPipe) quantity: number,
    @Req() req: any,
  ) {
    return this.cartService.updateItemQuantity(req.user.id, null, id, quantity);
  }

  // delete cart item
  @Delete('items/:id')
  async removeCartItem(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.cartService.removeItem(req.user.id, null, id);
  }
}
