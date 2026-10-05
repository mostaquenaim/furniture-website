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
import { OrderService } from 'src/order/order.service';
import { CreateOrderDto } from 'src/order/dto/create-order.dto';
import { Visitor } from 'handlebars';

@Controller('guest')
export class GuestController {
  constructor(
    private readonly guestService: GuestService,
    private readonly cartService: CartService,
    private readonly orderService: OrderService,
  ) {}

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

  @Post('cart/items')
  async addGuestItem(@Body(new ValidationPipe({ transform: true })) dto) {
    return this.cartService.addItemToGuestCart(dto.visitorId, dto);
  }

  @Get('cart/count/:visitorId')
  async countCartItems(@Param('visitorId') visitorId: string) {
    return this.cartService.countCartItems(null, visitorId);
  }

  @Patch('cart/apply-coupon/:cartId')
  async applyCoupon(
    @Param('cartId', ParseIntPipe) cartId: number,
    @Query('visitorId') visitorId: string,
    @Body('code') code: string,
  ) {
    return this.cartService.applyCoupon(null, visitorId, cartId, code);
  }

  @Delete('cart/coupon/:cartId')
  async removeCoupon(
    @Param('cartId', ParseIntPipe) cartId: number,
    @Query('visitorId') visitorId: string,
  ) {
    return this.cartService.removeCoupon(null, visitorId, cartId);
  }

  @Patch('items/:id')
  async updateCartItemQuantity(
    @Param('id', ParseIntPipe) id: number,
    @Query('visitorId') visitorId: string,
    @Body('quantity', ParseIntPipe) quantity: number,
  ) {
    return this.cartService.updateItemQuantity(null, visitorId, id, quantity);
  }

  @Delete('items/:id')
  async removeCartItem(
    @Param('id', ParseIntPipe) id: number,
    @Query('visitorId') visitorId: string,
  ) {
    return this.cartService.removeItem(null, visitorId, id);
  }

  // For creating Guest Order
  @Post('orders/create')
  async createGuestOrder(
    @Body(new ValidationPipe({ transform: true })) dto: CreateOrderDto,
    @Query('visitorId') visitorId: string,
  ) {
    if (!visitorId) {
      return {
        success: false,
        message: 'visitorId required',
      };
    }

    return this.orderService.createOrder(null, dto, visitorId);
  }

  // For getting all Guest Orders
  @Get('orders')
  getGuestOrders(
    @Query('visitorId') visitorId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.orderService.getGuestOrders(visitorId, {
      page: Math.max(1, Number(page) || 1),
      limit: Math.min(25, Math.max(1, Number(limit) || 10)),
    });
  }
}
