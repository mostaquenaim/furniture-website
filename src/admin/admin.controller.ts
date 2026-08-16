/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Controller,
  Get,
  UseGuards,
  Req,
  Post,
  Body,
  Patch,
  Param,
  ParseIntPipe,
  Delete,
  Query,
  Put,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { CategoryService } from 'src/category/category.service';
import { CreateSeriesDto } from 'src/category/dto/seriesDto.dto';
import cloudinary from './cloudinary.config';
import { CreateCategoryDto } from 'src/category/dto/categoryDto.dto';
import { CreateSubCategoryDto } from 'src/category/dto/subCategoryDto.dto';
import { CmsService } from 'src/cms/cms.service';
import { CreateColorDto } from 'src/cms/dto/create-color.dto';
import { CreateSizeDto } from 'src/cms/dto/create-size-dto.dto';
import { CreateVariantDto } from 'src/cms/dto/create-variant.dto';
import { ProductService } from 'src/product/product.service';
import { UpdateProductDto } from 'src/product/dto/update-product.dto';
import { CreateBlogDto } from 'src/blog/dto/create-blog.dto';
import { BlogsService } from 'src/blog/blog.service';
import { CreateBlogCategoryDto } from 'src/blog/dto/create-blog-category.dto';
import { CreateMaterialDto } from 'src/cms/dto/create-material.dto';
import { CreateProductDto } from 'src/product/dto/create-product.dto';
import { CreateCouponDto } from 'src/cms/dto/Coupon/create-coupon.dto';
import { UpdateDistrictDto } from 'src/cms/dto/update-district.dto';
import { CreateDistrictDto } from 'src/cms/dto/create-district.dto';
import { UpdateColorDto } from 'src/cms/dto/update-color.dto';
import { UpdateMaterialDto } from 'src/cms/dto/update-material.dto';
import { UpdateSizeDto } from 'src/cms/dto/update-size.dto';
import { UpdateVariantDto } from 'src/cms/dto/update-variant.dto';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { UpdatePromoBannerDto } from 'src/cms/dto/Banner/update-promo-banner.dto';
import { CreatePromoBannerDto } from 'src/cms/dto/Banner/create-promo-banner.dto';
import { UpsertStaticPageDto } from 'src/cms/dto/static-page/upsert-static-page.dto';
import { CreateTermsAndConditionDto } from 'src/cms/dto/terms-and-condition/create-terms-and-condition.dto';
import { UpdateTermsAndConditionDto } from 'src/cms/dto/terms-and-condition/update-terms-and-condition.dto';
import { OrderService } from 'src/order/order.service';
import { UpdateOrderStatusDto } from 'src/order/dto/update-order-status.dto';
import { CollectRemainderDto } from 'src/order/dto/collect-remainder.dto';
import { ReviewService } from 'src/review/review.service';
import { CreateCourierProviderDto } from 'src/courier/dto/create-courier-provider.dto';
import { CourierService } from 'src/courier/services/courier.service';
import { UpdateCourierProviderDto } from 'src/courier/dto/update-courier-provider.dto';
import { CreateCourierShipmentDto } from 'src/courier/dto/create-courier-shipment.dto';
import { Action } from 'src/permission/action.enum';
import { Permission } from 'src/permission/permission.decorator';
import { SkipPermission } from 'src/permission/skip-permission.decorator';
import { PathaoLocationSyncService } from 'src/courier/services/pathao-location-sync.service';
import { UpdateCouponDto } from 'src/cms/dto/Coupon/update-coupon.dto';
import { GetCouponsQueryDto } from 'src/cms/dto/Coupon/get-coupon-query.dto';
import { CreateBannerDto } from 'src/cms/dto/Banner/create-banner.dto';
import { UpdateBannerDto } from 'src/cms/dto/Banner/update-banner.dto';
import { SeasonalCategoryService } from 'src/seasonal-category/seasonal-category.service';
import { AdminService } from './admin.service';
import { FraudStatus, RefundStatus, ReturnRequestStatus } from '@prisma/client';
import { RefundService } from 'src/refund/refund.service';
import { ReviewReturnRequestDto } from 'src/refund/dto/review-return-request.dto';
import { ReceiveReturnItemsDto } from 'src/refund/dto/receive-return-items.dto';
import { ProcessRefundDto } from 'src/refund/dto/process-refund.dto';
import { DirectRefundDto } from 'src/refund/dto/direct-refund.dto';
import { CompleteManualRefundDto } from 'src/refund/dto/complete-manual-refund.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly blogService: BlogsService,
    private readonly categoryService: CategoryService,
    private readonly cmsService: CmsService,
    private readonly productService: ProductService,
    private readonly activityLogService: ActivityLogService,
    private readonly orderService: OrderService,
    private readonly reviewService: ReviewService,
    private readonly courierService: CourierService,
    private readonly pathaoLocationSyncService: PathaoLocationSyncService,
    private readonly seasonalCategoryService: SeasonalCategoryService,
    private readonly refundService: RefundService,
  ) {}

  // ADMIN DASHBOARD BASIC INFO
  @Get('all-series')
  @Permission(Action.CATEGORY_VIEW)
  findAll() {
    return this.categoryService.getAllSeries(true);
  }

  // series, category and subcategory creation
  @Post('series')
  @Permission(Action.CATEGORY_CREATE)
  createSeries(@Body() createSeriesDto: CreateSeriesDto, @Req() req: any) {
    return this.categoryService.createSeries(
      createSeriesDto,
      req?.user?.userId,
    );
  }

  @Post('category')
  @Permission(Action.CATEGORY_CREATE)
  createCategory(
    @Body() createCategoryDto: CreateCategoryDto,
    @Req() req: any,
  ) {
    return this.categoryService.createCategory(
      createCategoryDto,
      req?.user?.userId,
    );
  }

  @Post('subcategory')
  @Permission(Action.CATEGORY_CREATE)
  createSubCategory(
    @Body() createSubCategoryDto: CreateSubCategoryDto,
    @Req() req: any,
  ) {
    return this.categoryService.createSubCategory(
      createSubCategoryDto,
      req?.user?.userId,
    );
  }

  // update series order
  @Patch('series/reorder')
  @Permission(Action.CATEGORY_REORDER)
  async reorderSeries(
    @Req() req: any,
    @Body('orders') orders: { id: number; sortOrder: number }[],
  ) {
    return await this.categoryService.reorderSeries(req?.user?.userId, orders);
  }

  // update category order
  @Patch('categories/reorder')
  @Permission(Action.CATEGORY_REORDER)
  async reorderCategories(
    @Req() req: any,
    @Body('orders') orders: { id: number; sortOrder: number }[],
  ) {
    return await this.categoryService.reorderCategories(
      req?.user?.userId,
      orders,
    );
  }

  // update category order
  @Patch('subcategories/reorder')
  @Permission(Action.CATEGORY_REORDER)
  async reorderSubcategories(
    @Req() req: any,
    @Body('orders') orders: { id: number; sortOrder: number }[],
  ) {
    return await this.categoryService.reorderSubcategories(
      req?.user?.userId,
      orders,
    );
  }

  // update categories
  @Patch('series/:slug')
  @Permission(Action.CATEGORY_UPDATE)
  async updateSeries(
    @Req() req: any,
    @Param('slug') slug: string,
    @Body() seriesDto: CreateSeriesDto,
  ) {
    const updatedSeries = await this.categoryService.updateSeriesBySlug(
      req?.user?.userId,
      slug,
      seriesDto,
    );

    return {
      message: 'Series updated successfully',
      data: updatedSeries,
    };
  }

  // delete series
  @Delete('series/:slug')
  @Permission(Action.CATEGORY_DELETE)
  async deleteSeries(@Req() req: any, @Param('slug') slug: string) {
    return this.categoryService.deleteSeriesBySlug(req?.user?.userId, slug);
  }

  // update categories
  @Patch('category/:slug')
  @Permission(Action.CATEGORY_UPDATE)
  async updateCategory(
    @Req() req: any,
    @Param('slug') slug: string,
    @Body() categoryDto: CreateCategoryDto,
  ) {
    const updatedSeries = await this.categoryService.updateCategory(
      req?.user?.userId,
      slug,
      categoryDto,
    );

    return {
      message: 'Category updated successfully',
      data: updatedSeries,
    };
  }

  // delete category
  @Delete('category/:slug')
  @Permission(Action.CATEGORY_DELETE)
  async deleteCategory(@Req() req: any, @Param('slug') slug: string) {
    return this.categoryService.deleteCategoryBySlug(req?.user?.userId, slug);
  }

  // update categories
  @Patch('subcategory/:slug')
  @Permission(Action.CATEGORY_UPDATE)
  async updatesSubcategory(
    @Req() req: any,
    @Param('slug') slug: string,
    @Body() categoryDto: CreateSubCategoryDto,
  ) {
    const updatedSeries = await this.categoryService.updatesSubcategory(
      req?.user?.userId,
      slug,
      categoryDto,
    );

    return {
      message: 'Category updated successfully',
      data: updatedSeries,
    };
  }

  // delete subcategory
  @Delete('subcategory/:slug')
  @Permission(Action.CATEGORY_DELETE)
  async deleteSubcategory(@Req() req: any, @Param('slug') slug: string) {
    return this.categoryService.deleteSubCategoryBySlug(
      req?.user?.userId,
      slug,
    );
  }

  // ADMIN PROFILE
  @Get('profile')
  @SkipPermission()
  getAdminProfile(@Req() req) {
    return req?.user;
  }

  @Get('cloudinary-signature')
  @Permission(Action.PRODUCT_CREATE)
  getCloudinarySignature() {
    // console.log('cloudinary-signature');
    const timestamp = Math.round(Date.now() / 1000);

    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp,
        folder: 'products', // VERY IMPORTANT
      },
      process.env.CLOUDINARY_API_SECRET!,
    );

    return {
      signature,
      timestamp,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      folder: 'products',
    };
  }

  ////COLOR////
  @Post('colors')
  @Permission(Action.CMS_COLOR_MANAGE)
  addColor(@Body() createColorDto: CreateColorDto, @Req() req: any) {
    return this.cmsService.createColor(createColorDto, req?.user?.userId);
  }

  @Delete('/colors/:colorId')
  @Permission(Action.CMS_COLOR_MANAGE)
  deleteColor(@Req() req: any, @Param('colorId') colorId: number) {
    return this.cmsService.deleteColor(req?.user?.userId, colorId);
  }

  // update color
  @Patch('colors/:colorId')
  @Permission(Action.CMS_COLOR_MANAGE)
  updateColor(
    @Req() req: any,
    @Param('colorId') colorId: number,
    @Body() colorDto: UpdateColorDto,
  ) {
    return this.cmsService.updateColor(req?.user?.userId, colorId, colorDto);
  }

  @Post('sizes')
  @Permission(Action.CMS_SIZE_MANAGE)
  addSize(@Body() createSizeDto: CreateSizeDto, @Req() req: any) {
    return this.cmsService.createSize(createSizeDto, req?.user?.userId);
  }

  // delete size
  @Delete('/sizes/:sizeId')
  @Permission(Action.CMS_SIZE_MANAGE)
  deleteSize(@Req() req: any, @Param('sizeId') sizeId: number) {
    return this.cmsService.deleteSize(req?.user?.userId, sizeId);
  }

  // update size
  @Patch('sizes/:sizeId')
  @Permission(Action.CMS_SIZE_MANAGE)
  updateSize(
    @Req() req: any,
    @Param('sizeId') sizeId: number,
    @Body() sizeDto: UpdateSizeDto,
  ) {
    return this.cmsService.updateSize(req?.user?.userId, sizeId, sizeDto);
  }

  @Post('variants')
  @Permission(Action.CMS_VARIANT_MANAGE)
  addVariant(@Body() createVariantDto: CreateVariantDto, @Req() req: any) {
    return this.cmsService.createVariant(createVariantDto, req?.user?.userId);
  }

  // delete variant
  @Delete('/variants/:variantId')
  @Permission(Action.CMS_VARIANT_MANAGE)
  deleteVariant(@Req() req: any, @Param('variantId') variantId: number) {
    return this.cmsService.deleteVariant(req?.user?.userId, variantId);
  }

  // update variant
  @Patch('variants/:variantId')
  @Permission(Action.CMS_VARIANT_MANAGE)
  updateVariant(
    @Req() req: any,
    @Param('variantId') variantId: number,
    @Body() variantDto: UpdateVariantDto,
  ) {
    return this.cmsService.updateVariant(
      req?.user?.userId,
      variantId,
      variantDto,
    );
  }

  // create new material
  @Post('materials')
  @Permission(Action.CMS_MATERIAL_MANAGE)
  addMaterial(@Body() createMaterialDto: CreateMaterialDto, @Req() req: any) {
    return this.cmsService.addMaterial(createMaterialDto, req?.user?.userId);
  }

  // update material
  @Patch('materials/:materialId')
  @Permission(Action.CMS_MATERIAL_MANAGE)
  updateMaterial(
    @Req() req: any,
    @Param('materialId') materialId: number,
    @Body() materialDto: UpdateMaterialDto,
  ) {
    return this.cmsService.updateMaterial(
      req?.user?.userId,
      materialId,
      materialDto,
    );
  }

  // delete material
  @Delete('/materials/:materialId')
  @Permission(Action.CMS_MATERIAL_MANAGE)
  deleteMaterial(@Req() req: any, @Param('materialId') materialId: number) {
    return this.cmsService.deleteMaterial(req?.user?.userId, materialId);
  }

  //////////////////////
  ////// PRODUCT //////
  ////////////////////
  @Post('products')
  @Permission(Action.PRODUCT_CREATE)
  async createProduct(@Body() dto: CreateProductDto, @Req() req: any) {
    // console.log(JSON.stringify(dto, null, 2), 'dtoooo');
    // return true
    return this.productService.createProduct(
      dto,
      req?.user?.userId,
      req?.user?.role,
    );
  }

  @Patch('product/:productId')
  @Permission(Action.PRODUCT_UPDATE)
  async updateProduct(
    @Param('productId') productId: string,
    @Body() dto: UpdateProductDto,
    @Req() req: any,
  ) {
    // console.log(JSON.stringify(dto, null, 2), 'dtoooo');
    return this.productService.updateProduct(
      productId,
      dto,
      req?.user?.userId,
      req?.user?.role,
    );
  }

  @Patch('set-trend-score')
  @Permission(Action.PRODUCT_SYNC)
  async setTrendScore(@Req() req: any) {
    return this.productService.setTrendScore(req?.user?.userId);
  }

  @Patch('sync-product-quantity')
  @Permission(Action.PRODUCT_SYNC)
  async syncProductQuantity(@Req() req: any) {
    return this.productService.syncProductQuantity(req?.user?.userId);
  }

  // Review update
  @Patch('reviews/:reviewId')
  @Permission(Action.REVIEW_MANAGE)
  updateReview(
    @Param('reviewId', ParseIntPipe) id: number,
    @Body() updateData: { isHidden?: boolean; isFeatured?: boolean },
    @Req() req: any,
  ) {
    // req.user.userId assumes you have an AuthGuard providing the user
    const adminId = req?.user?.userId;
    return this.reviewService.updateReview(id, updateData, adminId);
  }

  // @Get('product-sync-prices')
  // async syncAllProductPrices() {
  //   console.log('admin');
  //   return this.productService.syncAllProductPrices();
  // }

  //////////////////////
  ////// BLOG //////
  ////////////////////
  @Post('/blogs')
  @Permission(Action.BLOG_CREATE)
  async createBlog(@Body() dto: CreateBlogDto, @Req() req: any) {
    // console.log(JSON.stringify(dto, null, 2), 'dtoooo');
    return this.blogService.createBlog(dto, req?.user?.userId);
  }

  @Post('blog-categories')
  @Permission(Action.BLOG_CATEGORY_CREATE)
  async createBlogCategory(
    @Body() dto: CreateBlogCategoryDto,
    @Req() req: any,
  ) {
    // console.log('DTO:', dto);
    return this.blogService.createBlogCategory(dto, req?.user?.userId);
  }

  //////////////////////
  ////// ORDER //////
  ////////////////////

  // ── Create ──────────────────────────────────────────────────────────────────

  @Post('create-coupon')
  @Permission(Action.COUPON_CREATE)
  async createCoupon(@Body() dto: CreateCouponDto, @Req() req: any) {
    return await this.cmsService.createCoupon(dto, req?.user?.userId);
  }

  // ── Get All (with optional filters) ────────────────────────────────────────

  @Get('coupons')
  @Permission(Action.COUPON_READ)
  async getAllCoupons(@Query() query: GetCouponsQueryDto) {
    return await this.cmsService.getAllCoupons(query);
  }

  // ── Get Single ──────────────────────────────────────────────────────────────

  @Get('coupons/:id')
  @Permission(Action.COUPON_READ)
  async getCouponById(@Param('id', ParseIntPipe) id: number) {
    return await this.cmsService.getCouponById(id);
  }

  // ── Update ──────────────────────────────────────────────────────────────────

  @Patch('coupons/:id')
  @Permission(Action.COUPON_UPDATE)
  async updateCoupon(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCouponDto,
    @Req() req: any,
  ) {
    return await this.cmsService.updateCoupon(id, dto, req?.user?.userId);
  }

  // ── Toggle active status ────────────────────────────────────────────────────
  // Convenience endpoint — frontend StatusBadge uses this for quick toggling
  // without sending the full payload.

  @Patch('coupons/:id/toggle-status')
  @Permission(Action.COUPON_UPDATE)
  async toggleCouponStatus(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    return await this.cmsService.toggleCouponStatus(id, req?.user?.userId);
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  @Delete('coupons/:id')
  @Permission(Action.COUPON_DELETE)
  async deleteCoupon(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return await this.cmsService.deleteCoupon(id, req?.user?.userId);
  }

  // whether the manual status dropdown is allowed to submit, or is
  // courier-webhook-only right now — read by the admin UI to disable the control
  @Get('orders/manual-status-enabled')
  @Permission(Action.ORDER_VIEW)
  getManualOrderStatusEnabled() {
    return { enabled: process.env.MANUAL_ORDER_STATUS_UPDATE === 'true' };
  }

  // update order status
  @Patch('orders/:orderId/status')
  @Permission(Action.ORDER_UPDATE_STATUS)
  updateOrderStatus(
    @Param('orderId') id: string,
    @Req() req: any,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orderService.updateOrderStatus(
      id,
      dto.status,
      req?.user?.userId,
    );
  }

  // collect the remaining cash balance for a COD order with an advance payment
  @Patch('orders/:orderId/collect-remainder')
  @Permission(Action.ORDER_UPDATE_STATUS)
  collectRemainder(
    @Param('orderId') id: string,
    @Req() req: any,
    @Body() dto: CollectRemainderDto,
  ) {
    return this.orderService.collectRemainder(id, dto, req?.user?.userId);
  }

  // direct refund for a cancelled/failed order's online payment — no physical return involved
  @Post('orders/:orderId/refund')
  @Permission(Action.REFUND_MANAGE)
  processDirectRefund(
    @Param('orderId') orderId: string,
    @Body() dto: DirectRefundDto,
    @Req() req: any,
  ) {
    return this.refundService.processDirectRefund(
      orderId,
      dto,
      req?.user?.userId,
    );
  }

  //////////////////////////////
  ////// RETURN REQUESTS //////
  ////////////////////////////

  @Get('return-requests')
  @Permission(Action.RETURN_VIEW)
  listReturnRequests(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: ReturnRequestStatus,
    @Query('search') search?: string,
  ) {
    return this.refundService.listReturnRequests({
      page: Number(page),
      limit: Number(limit),
      status,
      search,
    });
  }

  @Get('return-requests/:id')
  @Permission(Action.RETURN_VIEW)
  getReturnRequest(@Param('id', ParseIntPipe) id: number) {
    return this.refundService.getReturnRequest(id);
  }

  @Patch('return-requests/:id/review')
  @Permission(Action.RETURN_MANAGE)
  reviewReturnRequest(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewReturnRequestDto,
    @Req() req: any,
  ) {
    return this.refundService.reviewReturnRequest(id, dto, req?.user?.userId);
  }

  @Patch('return-requests/:id/receive')
  @Permission(Action.RETURN_MANAGE)
  receiveReturnItems(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReceiveReturnItemsDto,
    @Req() req: any,
  ) {
    return this.refundService.receiveReturnItems(id, dto, req?.user?.userId);
  }

  @Post('return-requests/:id/refund')
  @Permission(Action.REFUND_MANAGE)
  processReturnRefund(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ProcessRefundDto,
    @Req() req: any,
  ) {
    return this.refundService.processReturnRefund(id, dto, req?.user?.userId);
  }

  //////////////////////
  ////// REFUNDS //////
  ////////////////////

  @Get('refunds')
  @Permission(Action.REFUND_VIEW)
  listRefunds(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: RefundStatus,
    @Query('search') search?: string,
  ) {
    return this.refundService.listRefunds({
      page: Number(page),
      limit: Number(limit),
      status,
      search,
    });
  }

  @Get('refunds/:id')
  @Permission(Action.REFUND_VIEW)
  getRefund(@Param('id', ParseIntPipe) id: number) {
    return this.refundService.getRefund(id);
  }

  @Patch('refunds/:id/complete')
  @Permission(Action.REFUND_MANAGE)
  completeManualRefund(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CompleteManualRefundDto,
    @Req() req: any,
  ) {
    return this.refundService.completeManualRefund(id, dto, req?.user?.userId);
  }

  @Patch('refunds/:id/sync')
  @Permission(Action.REFUND_MANAGE)
  syncGatewayRefund(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.refundService.syncGatewayRefund(id, req?.user?.userId);
  }

  //////////////////////
  ////// COURIER //////
  ////////////////////

  @Post('providers')
  @Permission(Action.COURIER_MANAGE)
  addProvider(@Body() dto: CreateCourierProviderDto, @Req() req: any) {
    return this.courierService.addProvider(dto, req?.user?.userId);
  }

  @Patch('providers/:id')
  @Permission(Action.COURIER_MANAGE)
  updateProvider(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCourierProviderDto,
    @Req() req: any,
  ) {
    return this.courierService.updateProvider(id, dto, req?.user?.userId);
  }

  @Delete('providers/:id')
  @Permission(Action.COURIER_MANAGE)
  deleteProvider(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.courierService.deleteProvider(id, req?.user?.userId);
  }

  @Post('courier/shipments')
  @Permission(Action.COURIER_MANAGE)
  async createShipment(@Body() dto: CreateCourierShipmentDto, @Req() req: any) {
    return this.courierService.createShipment(dto, req?.user?.userId);
  }

  @Post('courier/shipments/:id/sync')
  @Permission(Action.COURIER_MANAGE)
  syncShipment(@Param('id', ParseIntPipe) id: number) {
    return this.courierService.syncShipmentStatus(id);
  }

  @Get('courier/shipments')
  @Permission(Action.COURIER_VIEW)
  getShipments(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('provider') provider?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.courierService.getShipments({
      page: Number(page),
      limit: Number(limit),
      provider,
      status,
      search,
    });
  }

  @Get('courier/shipments/:id')
  @Permission(Action.COURIER_VIEW)
  getShipmentById(@Param('id', ParseIntPipe) id: number) {
    return this.courierService.getShipmentById(id);
  }

  @Post('courier/shipments/:id/cancel')
  @Permission(Action.COURIER_MANAGE)
  cancelShipment(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.courierService.cancelShipment(id, req?.user?.userId);
  }

  // @Post('create-mock-coupons')
  // async createMockCoupons() {
  //   return this.cmsService.createMockCoupons();
  // }

  //////////////////////
  ////// OTHERS //////
  ////////////////////

  ///DISTRICTS///
  @Post('create-initial-districts')
  @Permission(Action.DISTRICT_MANAGE)
  async createInitialDistrict(@Req() req: any) {
    return this.cmsService.createInitialDistrict(req?.user?.userId);
  }

  @Post('create-districts')
  @Permission(Action.DISTRICT_MANAGE)
  async createDistrict(
    @Req() req: any,
    @Body() districtDto: CreateDistrictDto,
  ) {
    return this.cmsService.createDistrict(req?.user?.userId, districtDto);
  }

  @Get('sync-districts')
  @Permission(Action.DISTRICT_MANAGE)
  async getDistricts() {
    const syncDistricts = await this.pathaoLocationSyncService.syncCities();
    return syncDistricts;
  }

  @Get('sync-zones')
  @Permission(Action.DISTRICT_MANAGE)
  async getZones() {
    const syncZones = await this.pathaoLocationSyncService.syncZones();
    return syncZones;
  }

  // delete district
  @Delete('districts/:id')
  @Permission(Action.DISTRICT_MANAGE)
  async deleteDistrict(@Req() req: any, @Param('id') id: number) {
    return await this.cmsService.deleteDistrict(req?.user?.userId, id);
  }

  // tags
  @Post('tags')
  @Permission(Action.TAG_CREATE)
  async createTags(@Body('name') name: string, @Req() req: any) {
    return this.cmsService.createNewTag(name, req?.user?.userId);
  }

  // district id
  @Patch('districts/:id')
  @Permission(Action.DISTRICT_MANAGE)
  async updateDistrict(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDistrictDto: UpdateDistrictDto,
    @Req() req: any,
  ) {
    return this.cmsService.updateDistrict(
      id,
      updateDistrictDto,
      req?.user?.userId,
    );
  }

  @Get('activity-log')
  @Permission(Action.CMS_VIEW)
  async getActivityLogs(@Query() query: any) {
    return this.activityLogService.getLogs({
      module: query.module,
      adminId: query.adminId ? Number(query.adminId) : undefined,
      action: query.action,
      search: query.search,
      dateRange:
        query.from && query.to
          ? { from: new Date(query.from), to: new Date(query.to) }
          : undefined,
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      orderBy: query.orderBy,
    });
  }

  ///////////////////
  //// STATIC PAGES //
  ///////////////////

  // GET is served by CmsController's /static-pages (role-aware default:
  // active-only for the public, all pages for staff) — no separate admin
  // read route needed here.

  @Put('static-pages/:slug')
  @Permission(Action.CMS_STATIC_PAGE_MANAGE)
  upsertStaticPage(
    @Param('slug') slug: string,
    @Body() dto: UpsertStaticPageDto,
    @Req() req: any,
  ) {
    return this.cmsService.upsertStaticPage(slug, dto, req?.user?.userId);
  }

  @Delete('static-pages/:slug')
  @Permission(Action.CMS_STATIC_PAGE_MANAGE)
  deleteStaticPage(@Param('slug') slug: string, @Req() req: any) {
    return this.cmsService.deleteStaticPage(slug, req?.user?.userId);
  }

  ///////////////////////
  //// TERMS & CONDITIONS //
  ///////////////////////

  @Get('terms-and-conditions/:id')
  @Permission(Action.CMS_VIEW)
  getTermsAndConditionById(@Param('id', ParseIntPipe) id: number) {
    return this.cmsService.getTermsAndConditionById(id);
  }

  @Post('terms-and-conditions')
  @Permission(Action.CMS_TNC_MANAGE)
  createTermsAndCondition(
    @Body() dto: CreateTermsAndConditionDto,
    @Req() req: any,
  ) {
    return this.cmsService.createTermsAndCondition(dto, req?.user?.userId);
  }

  @Patch('terms-and-conditions/:id')
  @Permission(Action.CMS_TNC_MANAGE)
  updateTermsAndCondition(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTermsAndConditionDto,
    @Req() req: any,
  ) {
    return this.cmsService.updateTermsAndCondition(id, dto, req?.user?.userId);
  }

  @Delete('terms-and-conditions/:id')
  @Permission(Action.CMS_TNC_MANAGE)
  deleteTermsAndCondition(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    return this.cmsService.deleteTermsAndCondition(id, req?.user?.userId);
  }

  ///////////////////
  /////////BANNER//////
  //////////////////

  // ── PROMO BANNERS ─────────────────────────────────────────────────────────────

  @Post('promo-banners')
  @Permission(Action.BANNER_MANAGE)
  createPromoBanner(@Body() dto: CreatePromoBannerDto, @Req() req: any) {
    return this.cmsService.createPromoBanner(dto, req?.user?.userId);
  }

  @Put('promo-banners/:id')
  @Permission(Action.BANNER_MANAGE)
  updatePromoBanner(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePromoBannerDto,
    @Req() req: any,
  ) {
    return this.cmsService.updatePromoBanner(id, dto, req?.user?.userId);
  }

  @Delete('promo-banners/:id')
  @Permission(Action.BANNER_MANAGE)
  removePromoBanner(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.cmsService.removePromoBanner(id, req?.user?.userId);
  }

  // ── HOMEPAGE BANNERS ──────────────────────────────────────────────────────────

  @Post('homepage-banners')
  @Permission(Action.BANNER_MANAGE)
  createHomepageBanner(@Body() dto: CreateBannerDto, @Req() req: any) {
    return this.cmsService.createHomepageBanner(dto, req?.user?.userId);
  }

  @Put('homepage-banners/:id')
  @Permission(Action.BANNER_MANAGE)
  updateHomepageBanner(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBannerDto,
    @Req() req: any,
  ) {
    return this.cmsService.updateHomepageBanner(id, dto, req?.user?.userId);
  }

  @Delete('homepage-banners/:id')
  @Permission(Action.BANNER_MANAGE)
  removeHomepageBanner(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.cmsService.removeHomepageBanner(id, req?.user?.userId);
  }

  ///////////////////
  /////////USER//////
  //////////////////

  ///////////////////
  /////////FRAUD//////
  //////////////////

  @Post('fraud/check-phone')
  @Permission(Action.FRAUD_MANAGE)
  checkFraudByPhone(@Body('phone') phone: string) {
    return this.adminService.checkFraudByPhone(phone);
  }

  @Get('fraud/history/:phone')
  @Permission(Action.FRAUD_MANAGE)
  getFraudHistory(@Param('phone') phone: string) {
    return this.adminService.getFraudHistory(decodeURIComponent(phone));
  }

  @Patch('users/:userId/fraud-status')
  @Permission(Action.FRAUD_MANAGE)
  updateUserFraudStatus(
    @Param('userId', ParseIntPipe) userId: number,
    @Body('status') status: FraudStatus,
  ) {
    return this.adminService.updateUserFraudStatus(userId, status);
  }

  @Get('fraud/users')
  @Permission(Action.FRAUD_MANAGE)
  getUsers(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('fraudStatus') fraudStatus?: FraudStatus,
    @Query('search') search?: string,
  ) {
    return this.adminService.getUsers({
      page: Number(page),
      limit: Number(limit),
      fraudStatus,
      search,
    });
  }
}
