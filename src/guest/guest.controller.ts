/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ValidationPipe,
  Patch,
  ParseIntPipe,
  Delete,
} from '@nestjs/common';
import { CartService } from 'src/cart/cart.service';
import { GuestService } from './guest.service';

@Controller('guest')
export class GuestController {
  constructor(
    private readonly guestService: GuestService,
    private readonly cartService: CartService,
  ) {}

  // create visitor id
  @Post('init')
  async createVisitor(@Body('visitorId') visitorId: string) {
    if (!visitorId) {
      return { success: false, message: 'visitorId required' };
    }

    await this.guestService.createVisitor(visitorId);

    return {
      success: true,
    };
  }

  // guest cart get
  @Get('cart/items/:visitorId')
  async getGuestCartItems(
    @Param('visitorId') visitorId: string,
    @Query('productSlug') productSlug?: string,
    @Query('colorId') colorId?: string,
    @Query('sizeId') sizeId?: string,
    @Query('summary') isSummary?: boolean,
  ) {
    return this.cartService.getCartItems(null, visitorId, {
      productSlug: productSlug || undefined,
      colorId: colorId ? +colorId : undefined,
      sizeId: sizeId ? +sizeId : undefined,
      isSummary: isSummary ? true : undefined,
    });
  }

  // guest cart add
  @Post('cart/items')
  async addGuestItem(
    // @Query('visitorId') visitorId: string,
    @Body(new ValidationPipe({ transform: true })) dto,
  ) {
    // if (!visitorId) {
    //   throw new BadRequestException('visitorId missing');
    // }

    return this.cartService.addItemToGuestCart(dto.visitorId, dto);
  }

  // count guest cart
  @Get('cart/count/:visitorId')
  async countCartItems(@Param('visitorId') visitorId: string) {
  // console.log('count/guest');
    return this.cartService.countCartItems(null, visitorId);
  }

  // apply coupon
  @Patch('cart/apply-coupon/:cartId')
  async applyCoupon(
    @Param('cartId', ParseIntPipe) cartId: number,
    @Query('visitorId') visitorId: string,
    @Body('code') code: string,
  ) {
    return this.cartService.applyCoupon(null, visitorId, cartId, code);
  }

  // update cart item quantity
  @Patch('items/:id')
  async updateCartItemQuantity(
    @Param('id', ParseIntPipe) id: number,
    @Query('visitorId') visitorId: string,
    @Body('quantity', ParseIntPipe) quantity: number,
  ) {
    return this.cartService.updateItemQuantity(null, visitorId, id, quantity);
  }

  // delete cart item
  @Delete('items/:id')
  async removeCartItem(
    @Param('id', ParseIntPipe) id: number,
    @Query('visitorId') visitorId: string,
  ) {
    return this.cartService.removeItem(null, visitorId, id);
  }
}
