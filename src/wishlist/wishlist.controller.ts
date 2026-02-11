/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Controller,
  Get,
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
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.wishlistService.getWishlist(req.user.userId, {
      page: Number(page) || 1,
      limit: Number(limit) || 8,
    });
  }

  @Get('isWIshed/:productSlug')
  getIsWished(@Req() req: any, @Param('productSlug') productSlug: string) {
    return this.wishlistService.getIsWished(req?.user?.userId, productSlug);
  }

  // toggle product wish
  @Patch('toggle/:productId')
  toggleWishlist(@Param('productId') productId: number, @Req() req) {
    return this.wishlistService.toggleWishlist(req?.user?.userId, productId);
  }

  // delete wish
  @Delete('delete/:productId')
  deleteWishItem(@Param('productId') productId: number, @Req() req: any) {
    return this.wishlistService.removeItem(productId, req?.user?.userId);
  }

  // Handles: DELETE /wishlist (with body { ids: [1, 2, 3] })
  @Delete('bulk-delete')
  async removeMany(@Body('ids') ids: number[], @Req() req: any) {
    return this.wishlistService.removeManyItems(ids, req?.user?.userId);
  }
}
