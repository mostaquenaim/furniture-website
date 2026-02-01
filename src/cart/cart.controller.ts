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
    console.log('cart items');
    // if (process.env.NODE_ENV === 'development') {
    //   console.log(
    //     req?.user?.userId,
    //     { productSlug, colorId, sizeId },
    //     'productSlug, colorId, sizeId',
    //   );
    // }

    return await this.cartService.getCartItems(req.user.userId, {
      productSlug: productSlug ? productSlug : undefined,
      colorId: colorId ? +colorId : undefined,
      sizeId: sizeId ? +sizeId : undefined,
      isSummary: isSummary ? isSummary : undefined,
    });
  }

  // get cart by product size id
  @Get('items/:productSizeId')
  async getCartItemByProductSizeId(
    @Req() req,
    @Query('productSizeId') productSizeId: string,
  ) {
    console.log('cart item by product size id');
    return await this.cartService.getCartItemByProductSizeId(req.user.userId, {
      sizeId: productSizeId ? +productSizeId : undefined,
    });
  }

  // Add an item to cart
  @Get('count')
  async countCartItems(@Req() req) {
    console.log('found');
    return this.cartService.countCartItems(req.user.userId);
  }

  // apply coupon
  @Patch('apply-coupon/:cartId')
  async applyCoupon(
    @Param('cartId', ParseIntPipe) cartId: number,
    @Body('code') code: string,
  ) {
    return this.cartService.applyCoupon(cartId, code);
  }

  // update cart item quantity
  @Patch('items/:id')
  async updateCartItemQuantity(
    @Param('id', ParseIntPipe) id: number,
    @Body('quantity', ParseIntPipe) quantity: number,
    @Req() req: any,
  ) {
    return this.cartService.updateItemQuantity(req.user.id, id, quantity);
  }

  // delete cart item
  @Delete('items/:id')
  async removeCartItem(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.cartService.removeItem(req.user.id, id);
  }
}
