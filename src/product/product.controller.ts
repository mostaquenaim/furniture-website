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
  Res,
  UseGuards,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { OptionalJwtAuthGuard } from 'src/auth/guards/optional-jwt-auth.guard';
import type { Response } from 'express';
import { BarcodeService } from 'src/barcode/barcode.service';

@Controller('product')
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly barcodeService: BarcodeService,
  ) {}

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
  @Get('you-may-also-like')
  async youMayAlsoLike(
    @Query('productSlug') productSlug?: string,
    @Query('productIds') productIds?: string,
    @Query('categorySlug') categorySlug?: string,
    @Query('categoryIds') categoryIds?: string,
  ) {
    const ids = productIds ? productIds.split(',').map(Number) : [];
    const catIds = categoryIds ? categoryIds.split(',').map(Number) : [];

    if (categorySlug || categoryIds)
      return this.productService.getSubCategoryBasedRecommendations(
        categorySlug,
        catIds,
      );
    else
      return this.productService.youMayAlsoLike(
        productSlug,
        ids,
        categorySlug,
        catIds,
      );
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

  // recently viewed
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
    return this.productService.getProductBySlug(slug);
  }

  @Patch(':productId/toggle-status')
  toggleProductStatusBySlug(@Param('productId') productId: string) {
    return this.productService.toggleProductStatusBySlug(productId);
  }

  // @Patch(':productId/toggle-status')
  // toggleProductStatusBySlug(@Param('productId') productId: string) {
  //   return this.productService.toggleProductStatusBySlug(productId);
  // }

  @Get(':id/barcodeimage')
  streamImage(@Param('id') id: string, @Res() res: Response) {
    return this.barcodeService.streamBarcodeImage(id, res);
  }
}
