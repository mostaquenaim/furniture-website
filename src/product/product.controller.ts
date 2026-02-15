/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { OptionalJwtAuthGuard } from 'src/auth/guards/optional-jwt-auth.guard';

@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get('all')
  getAllProducts(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,

    @Query('colorIds') colorIds?: string,
    @Query('materialIds') materialIds?: string,

    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('sortBy') sortBy?: string,
    @Query('order') order: 'asc' | 'desc' = 'asc',
    @Query('thumb') thumb?: boolean,
  ) {
    console.log(sortBy, order, 'sortBy', 'order');
    return this.productService.getAllProducts({
      page: Number(page) || 1,
      limit: Number(limit) || 10,
      search,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      orderBy: sortBy ? { [sortBy]: order } : undefined,
      thumb,
      colorIds: colorIds ? colorIds.split(',').map(Number) : undefined,
      materialIds: materialIds ? materialIds.split(',').map(Number) : undefined,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
    });
  }

  // you may also like / recommended / related products
  @Get('you-may-also-like/:productSlug')
  async youMayAlsoLike(
    @Param('productSlug') productSlug: string,
    @Query('productIds') productIds?: string,
  ) {
    const ids = productIds ? productIds.split(',').map(Number) : [];

    console.log(ids);

    return this.productService.youMayAlsoLike(productSlug, ids);
  }

  // product.controller.ts
  @Post('/view/:id')
  @UseGuards(OptionalJwtAuthGuard)
  async addProductView(
    @Param('id') id: number,
    @Req() req: any,
    @Body('visitorId') visitorId?: string,
  ) {
    const userId = req?.user?.userId ?? null;

    console.log(userId, id, visitorId);

    return this.productService.addProductView(id, userId, visitorId ?? null);
  }

  // recommended products
  @Get('recommended')
  @UseGuards(OptionalJwtAuthGuard)
  async recommendedProducts(@Req() req: any, @Query('limit') limit?: string) {
    // User may or may not be logged in
    const userId = req?.user?.userId ?? null;

    // Parse limit, default to 10 if missing or invalid
    const parsedLimit = limit ? parseInt(limit, 10) : 10;

    console.log(userId, parsedLimit);
    // Call the service with safe values
    return this.productService.recommendedProducts(userId, parsedLimit);
  }

  // recommended products
  @Get('recently-viewed')
  @UseGuards(OptionalJwtAuthGuard)
  async recentlyViewed(
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('visitorId') visitorId?: string,
  ) {
    const userId = req?.user?.userId ?? null;
    const parsedLimit = limit ? parseInt(limit, 10) : 10;

    return this.productService.recentlyViewed(
      userId,
      visitorId ?? null,
      parsedLimit,
    );
  }

  // product reviews
  @Get('review/:slug')
  async getProductReviews(@Param('slug') slug: string) {
    console.log('slug/review');
    return this.productService.getProductReviews(slug);
  }

  // @Get('trending')
  // async getTrendingProducts(){

  // }

  @Get(':slug')
  getProductById(@Param('slug') slug: string) {
    return this.productService.getProductById(slug);
  }

  @Patch(':productId/toggle-status')
  toggleProductStatusBySlug(@Param('productId') productId: string) {
    return this.productService.toggleProductStatusBySlug(productId);
  }

  // @Patch(':productId/toggle-status')
  // toggleProductStatusBySlug(@Param('productId') productId: string) {
  //   return this.productService.toggleProductStatusBySlug(productId);
  // }
}
