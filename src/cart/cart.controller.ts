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
import { OptionalJwtAuthGuard } from 'src/auth/guards/optional-jwt-auth.guard';

// @UseGuards(JwtAuthGuard)
@UseGuards(OptionalJwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post('items')
  async addItem(
    @Req() req,
    @Body(new ValidationPipe({ transform: true })) dto: AddCartItemDto,
  ) {
    return this.cartService.addItemToCart(req?.user?.userId, dto);
  }

  @Get('items')
  async getCartItems(
    @Req() req,
    @Query('productSlug') productSlug?: string,
    @Query('colorId') colorId?: string,
    @Query('sizeId') sizeId?: string,
    @Query('summary') isSummary?: boolean,
  ) {
    return await this.cartService.getCartItems(req?.user?.userId, null, {
      productSlug: productSlug ? productSlug : undefined,
      colorId: colorId ? +colorId : undefined,
      sizeId: sizeId ? +sizeId : undefined,
      isSummary: isSummary ? isSummary : undefined,
    });
  }

  @Get('count')
  async countCartItems(@Req() req) {
    return this.cartService.countCartItems(req?.user?.userId, null);
  }

  // apply coupon
  @Patch('apply-coupon/:cartId')
  async applyCoupon(
    @Param('cartId', ParseIntPipe) cartId: number,
    @Body('code') code: string,
    @Req() req: any,
    @Query('visitorId') visitorId?: string,
  ) {
    return this.cartService.applyCoupon(
      req?.user?.userId,
      visitorId || null,
      cartId,
      code,
    );
  }

  // update cart item quantity
  @Patch('items/:id')
  async updateCartItemQuantity(
    @Param('id', ParseIntPipe) id: number,
    @Body('quantity', ParseIntPipe) quantity: number,
    @Req() req: any,
    @Query('visitorId') visitorId?: string,
  ) {
    return this.cartService.updateItemQuantity(
      req?.user?.userId,
      visitorId || null,
      id,
      quantity,
    );
  }

  // delete cart item
  @Delete('items/:id')
  async removeCartItem(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Query('visitorId') visitorId?: string,
  ) {
    return this.cartService.removeItem(
      req?.user?.userId,
      visitorId || null,
      id,
    );
  }

  // empty the whole active cart — used by "Buy Now" before adding its item
  @Delete('clear')
  async clearCart(@Req() req: any, @Query('visitorId') visitorId?: string) {
    return this.cartService.clearCart(req?.user?.userId, visitorId || null);
  }
}
