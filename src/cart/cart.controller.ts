/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  ValidationPipe,
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
    // console.log('DTO received:', dto);
    return this.cartService.addItemToCart(req.user.userId, dto);
  }
}
