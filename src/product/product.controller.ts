/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { markPublicCacheable } from 'src/common/utils/public-cache-headers';
import { ProductService } from './product.service';
import { OptionalJwtAuthGuard } from 'src/auth/guards/optional-jwt-auth.guard';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Permission } from 'src/permission/permission.decorator';
import { Action } from 'src/permission/action.enum';
import type { Response } from 'express';
import { BarcodeService } from 'src/barcode/barcode.service';
import { ReviewService } from 'src/review/review.service';
import { parseSortParams } from 'src/common/utils/sort.utils';
import { PRODUCT_SORT_FIELDS } from './product-sort';

@Controller('product')
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly barcodeService: BarcodeService,
    private readonly reviewService: ReviewService,
  ) {}

  // Storefront listing: active, in-stock products only.
  @Get('all')
  async getAllProducts(
    @Res({ passthrough: true }) res: Response,
    @Query() query: Record<string, any>,
  ) {
    // These used to widen this public listing to inactive / out-of-stock
    // products for anyone. Refuse them loudly so a stale admin page fails
    // visibly instead of quietly showing a partial list.
    if (query.isActive !== undefined || query.includeOutOfStock !== undefined) {
      throw new BadRequestException(
        'isActive / includeOutOfStock are staff-only: use GET /product/admin/all',
      );
    }

    const result = await this.productService.getAllProducts(
      this.parseListingQuery(query),
    );
    markPublicCacheable(res);
    return result;
  }

  // Admin product list: inactive and out-of-stock products included on request
  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.PRODUCT_VIEW)
  getAdminProducts(@Query() query: Record<string, any>) {
    return this.productService.getAdminProducts(
      this.parseStaffListingQuery(query),
    );
  }

  // Flash-sale product picker — same listing, gated by the flash-sale
  // permission so sale managers don't also need PRODUCT_VIEW.
  @Get('admin/flash-sale-picker')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.FLASH_SALE_MANAGE)
  getFlashSalePickerProducts(@Query() query: Record<string, any>) {
    return this.productService.getAdminProducts(
      this.parseStaffListingQuery(query),
    );
  }

  // Storefront listing params — has no way to express inactive/out-of-stock
  private parseListingQuery(query: Record<string, any>) {
    const {
      page,
      limit,
      search,
      colorIds,
      materialIds,
      subCategoryIds,
      minPrice,
      maxPrice,
      sortBy,
      order = 'asc',
      thumb,
    } = query;

    return {
      page: Number(page) || 1,
      // No limit passed => return every matching product (no pagination).
      limit: limit !== undefined ? Number(limit) : undefined,
      search: typeof search === 'string' ? search : undefined,
      orderBy: this.productService.resolveOrderBy(sortBy, order),
      thumb: thumb === true || thumb === 'true',
      colorIds: colorIds ? String(colorIds).split(',').map(Number) : undefined,
      materialIds: materialIds
        ? String(materialIds).split(',').map(Number)
        : undefined,
      subCategoryIds: subCategoryIds
        ? String(subCategoryIds).split(',').map(Number)
        : undefined,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
    };
  }

  // Staff listing params: the storefront ones plus the inactive /
  // out-of-stock filters
  private parseStaffListingQuery(query: Record<string, any>) {
    const { isActive, includeOutOfStock } = query;
    return {
      ...this.parseListingQuery(query),
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      includeOutOfStock: includeOutOfStock === 'true',
    };
  }

  // you may also like / recommended / related products
  @Get('you-may-also-like')
  async youMayAlsoLike(
    @Res({ passthrough: true }) res: Response,
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

    const result =
      catIds.length > 0
        ? await this.productService.getSubCategoryBasedRecommendations(
            cleanCategorySlug,
            catIds,
          )
        : await this.productService.youMayAlsoLike(
            cleanProductSlug,
            ids,
            cleanCategorySlug,
            catIds,
          );
    markPublicCacheable(res);
    return result;
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

  // product reviews — public: visible reviews only
  @Get('reviews')
  @UseGuards(OptionalJwtAuthGuard)
  async getProductReviews(@Query() query: Record<string, any>) {
    // isHidden used to let anyone read hidden reviews. Refuse it rather than
    // ignore it, so a stale moderation page fails visibly instead of quietly
    // showing only the visible ones.
    if (query.isHidden !== undefined) {
      throw new BadRequestException(
        'isHidden is staff-only: use GET /product/admin/reviews',
      );
    }
    return this.productService.getProductReviews({
      ...this.parseReviewQuery(query),
      isHidden: false,
    });
  }

  // Review moderation list: hidden reviews included (isHidden=null → all)
  @Get('admin/reviews')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.REVIEW_MANAGE)
  async getAdminProductReviews(@Query() query: Record<string, any>) {
    const { isHidden } = query;
    return this.productService.getProductReviews({
      ...this.parseReviewQuery(query),
      isHidden: isHidden === 'true' ? true : isHidden === 'null' ? null : false,
    });
  }

  private parseReviewQuery(query: Record<string, any>) {
    const {
      productSlug,
      minRating,
      maxRating,
      isFeatured,
      fromDate,
      toDate,
      customerId,
    } = query;
    return {
      productSlug: typeof productSlug === 'string' ? productSlug : undefined,
      minRating: minRating !== undefined ? Number(minRating) : undefined,
      maxRating: maxRating !== undefined ? Number(maxRating) : undefined,
      isFeatured: isFeatured === 'true' ? true : undefined,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      customerId: customerId ? parseInt(customerId) : undefined,
    };
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
  async getTrendingProducts(
    @Res({ passthrough: true }) res: Response,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    const result = await this.productService.getTrendingProducts(parsedLimit);
    markPublicCacheable(res);
    return result;
  }

  // featured products (Product.isFeatured, set from the product admin form)
  @Get('featured')
  async getFeaturedProducts(
    @Res({ passthrough: true }) res: Response,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    const result = await this.productService.getFeaturedProducts(parsedLimit);
    markPublicCacheable(res);
    return result;
  }

  @Get('on-sale/status')
  async getSaleStatus(@Res({ passthrough: true }) res: Response) {
    const result = await this.productService.getSaleStatus();
    markPublicCacheable(res);
    return result;
  }

  @Get('on-sale')
  async getOnSaleProducts(
    @Res({ passthrough: true }) res: Response,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sortBy') sortBy?: string,
    @Query('order') order: 'asc' | 'desc' = 'desc',
  ) {
    const result = await this.productService.getOnSaleProducts({
      page: Number(page) || 1,
      limit: Number(limit) || 18,
      sortBy: sortBy || 'createdAt',
      order,
    });
    markPublicCacheable(res);
    return result;
  }

  @Get(':slug/schema')
  async getProductSchema(
    @Res({ passthrough: true }) res: Response,
    @Param('slug') slug: string,
  ) {
    const result = await this.productService.generateProductSchema(slug);
    markPublicCacheable(res);
    return result;
  }

  // Full product for the admin edit form: includes inactive materials, tags
  // and out-of-stock sizes, so it's staff-only and never cached.
  @Get(':slug/admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.PRODUCT_UPDATE)
  getProductForAdmin(@Param('slug') slug: string) {
    return this.productService.getProductBySlug(slug, true);
  }

  @Get(':slug')
  async getProductById(
    @Res({ passthrough: true }) res: Response,
    @Param('slug') slug: string,
    @Query('admin') admin?: string,
  ) {
    // The admin view used to be ?admin=true on this public route. Refuse it
    // loudly rather than quietly returning the storefront view: an edit form
    // hydrated from storefront data (no out-of-stock sizes, no tags) and then
    // saved would drop them.
    if (admin === 'true') {
      throw new BadRequestException(
        'The admin product view moved to GET /product/:slug/admin',
      );
    }
    const result = await this.productService.getProductBySlug(slug);
    markPublicCacheable(res);
    return result;
  }

  @Patch(':productId/toggle-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.PRODUCT_UPDATE)
  toggleProductStatusBySlug(@Param('productId') productId: string) {
    return this.productService.toggleProductStatusBySlug(productId);
  }

  // Permanent delete. PRODUCT_DELETE is off for every role until a
  // superadmin grants it; SUPERADMIN always passes RolesGuard.
  @Get(':slug/delete-preview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.PRODUCT_DELETE)
  getProductDeletePreview(@Param('slug') slug: string) {
    return this.productService.getProductDeletePreview(slug);
  }

  @Delete(':slug')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.PRODUCT_DELETE)
  deleteProduct(@Param('slug') slug: string, @Req() req: any) {
    return this.productService.deleteProductBySlug(slug, req.user.userId);
  }

  @Get(':id/barcodeimage')
  streamImage(@Param('id') id: string, @Res() res: Response) {
    return this.barcodeService.streamBarcodeImage(id, res);
  }
}
