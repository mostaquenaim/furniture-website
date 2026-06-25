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
import { ReviewService } from 'src/review/review.service';

@Controller('product')
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly barcodeService: BarcodeService,
    private readonly reviewService: ReviewService,
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
  // console.log(sortBy, order, 'sortBy', 'order');
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
    const clean = (val?: string) =>
      val && val !== 'undefined' && val !== 'null' && val !== ''
        ? val
        : undefined;

    const cleanProductIds = clean(productIds);
    const cleanCategoryIds = clean(categoryIds);
    const cleanProductSlug = clean(productSlug);
    const cleanCategorySlug = clean(categorySlug);

    const ids = cleanProductIds
      ? cleanProductIds
          .split(',')
          .map(Number)
          .filter((n) => !isNaN(n))
      : [];

    const catIds = cleanCategoryIds
      ? cleanCategoryIds
          .split(',')
          .map(Number)
          .filter((n) => !isNaN(n))
      : [];

  // console.log(ids, cleanProductSlug, cleanCategorySlug, catIds, 'cleaned');

    if (catIds.length > 0) {
      return this.productService.getSubCategoryBasedRecommendations(
        cleanCategorySlug,
        catIds,
      );
    }

    return this.productService.youMayAlsoLike(
      cleanProductSlug,
      ids,
      cleanCategorySlug,
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

  // console.log(userId, id, visitorId);

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

  // console.log(userId, parsedLimit);
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
  @Get('reviews')
  @UseGuards(OptionalJwtAuthGuard)
  async getProductReviews(
    @Query('productSlug') productSlug?: string,
    @Query('minRating') minRating?: string,
    @Query('maxRating') maxRating?: string,
    @Query('isHidden') isHidden?: string,
    @Query('isFeatured') isFeatured?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('customerId') customerId?: string,
    @Req() req?: any,
  ) {
    // console.log(isHidden, 'isHidden');

    return this.productService.getProductReviews({
      productSlug: productSlug !== undefined ? productSlug : undefined,
      minRating: minRating !== undefined ? Number(minRating) : undefined,
      maxRating: maxRating !== undefined ? Number(maxRating) : undefined,
      isHidden: isHidden === 'true' ? true : isHidden === 'null' ? null : false,
      isFeatured: isFeatured === 'true' ? true : undefined,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      adminId: req?.user?.userId,
      customerId: customerId ? parseInt(customerId) : undefined,
    });
  }

  // get a random featured review
  @Get('reviews/random-featured')
  getAFeaturedReview() {
    return this.reviewService.getAFeaturedReview();
  }

  // get a featured reviews
  @Get('reviews/all-featured')
  getFeaturedReviews() {
    return this.reviewService.getAllFeaturedReviews();
  }

  // trending products
  @Get('trending')
  getTrendingProducts(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    return this.productService.getTrendingProducts(parsedLimit);
  }

  @Get('on-sale')
  getOnSaleProducts(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sortBy') sortBy?: string,
    @Query('order') order: 'asc' | 'desc' = 'desc',
  ) {
    return this.productService.getOnSaleProducts({
      page: Number(page) || 1,
      limit: Number(limit) || 18,
      sortBy: sortBy || 'createdAt',
      order,
    });
  }

  @Get(':slug/schema')
  getProductSchema(@Param('slug') slug: string) {
    return this.productService.generateProductSchema(slug);
  }

  // }
  @Get(':slug')
  getProductById(@Param('slug') slug: string, @Query('admin') admin?: string) {
    return this.productService.getProductBySlug(slug, admin === 'true');
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
