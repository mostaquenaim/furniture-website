/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  Query,
} from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { AddWishlistDto } from './dto/add-wishlist.dto';

@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  getWishlist(
    @Req() req,
    @Query('page') page = '1',
    @Query('limit') limit = '8',
  ) {
    return this.wishlistService.getWishlist(
      req.user.id,
      Number(page),
      Number(limit),
    );
  }

  @Post()
  addToWishlist(@Body() dto: AddWishlistDto, @Req() req) {
    return this.wishlistService.add(req.user.id, dto.productId);
  }

  @Delete(':productId')
  removeFromWishlist(@Param('productId') productId: string, @Req() req) {
    return this.wishlistService.remove(req.user.id, productId);
  }
}
