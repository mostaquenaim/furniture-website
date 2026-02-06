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
  UseGuards,
  Patch,
} from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
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
      req?.user?.userId,
      Number(page),
      Number(limit),
    );
  }

  @Get('isWIshed/:productSlug')
  getIsWished(@Req() req: any, @Param('productSlug') productSlug: string) {
    return this.wishlistService.getIsWished(req?.user?.userId, productSlug);
  }

  // toggle product wish
  @Patch('toggle/:productId')
  addToWishlist(@Param('productId') productId: number, @Req() req) {
    return this.wishlistService.toggleWishlist(req?.user?.userId, productId);
  }
}
