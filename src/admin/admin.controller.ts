/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
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
import { CreateCouponDto } from 'src/cms/dto/create-coupon.dto';
import { UpdateDistrictDto } from 'src/cms/dto/update-district.dto';
import { CreateDistrictDto } from 'src/cms/dto/create-district.dto';
import { UpdateColorDto } from 'src/cms/dto/update-color.dto';
import { UpdateMaterialDto } from 'src/cms/dto/update-material.dto';
import { UpdateSizeDto } from 'src/cms/dto/update-size.dto';
import { UpdateVariantDto } from 'src/cms/dto/update-variant.dto';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { UpdatePromoBannerDto } from 'src/cms/dto/update-promo-banner.dto';
import { CreatePromoBannerDto } from 'src/cms/dto/create-promo-banner.dto';
import { OrderService } from 'src/order/order.service';
import { OrderStatus } from '@prisma/client';
import { ReviewService } from 'src/review/review.service';
import { CreateCourierProviderDto } from 'src/courier/dto/create-courier-provider.dto';
import { CourierService } from 'src/courier/services/courier.service';
import { UpdateCourierProviderDto } from 'src/courier/dto/update-courier-provider.dto';
import { CreateCourierShipmentDto } from 'src/courier/dto/create-courier-shipment.dto';
import { Action } from 'src/permission/action.enum';
import { Permission } from 'src/permission/permission.decorator';
import { SkipPermission } from 'src/permission/skip-permission.decorator';
import { PathaoLocationSyncService } from 'src/courier/services/pathao-location-sync.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(
    private readonly blogService: BlogsService,
    private readonly categoryService: CategoryService,
    private readonly cmsService: CmsService,
    private readonly productService: ProductService,
    private readonly activityLogService: ActivityLogService,
    private readonly orderService: OrderService,
    private readonly reviewService: ReviewService,
    private readonly courierService: CourierService,
    private readonly pathaoLocationSyncService: PathaoLocationSyncService,
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
    return this.productService.createProduct(dto, req?.user?.userId);
  }

  @Patch('product/:productId')
  @Permission(Action.PRODUCT_UPDATE)
  async updateProduct(
    @Param('productId') productId: string,
    @Body() dto: UpdateProductDto,
    @Req() req: any,
  ) {
    // console.log(JSON.stringify(dto, null, 2), 'dtoooo');
    return this.productService.updateProduct(productId, dto, req?.user?.userId);
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

  //create coupons
  @Post('create-coupon')
  @Permission(Action.COUPON_CREATE)
  async createCoupon(@Body() dto: CreateCouponDto, @Req() req: any) {
    return await this.cmsService.createCoupon(dto, req?.user?.userId);
  }

  // update order status
  @Patch('orders/:orderId/status')
  @Permission(Action.ORDER_UPDATE_STATUS)
  updateOrderStatus(
    @Param('orderId') id: string,
    @Req() req: any,
    @Body('status') status: OrderStatus,
  ) {
    return this.orderService.updateOrderStatus(id, status, req?.user?.userId);
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

  // delete coupon
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
  @SkipPermission()
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
    });
  }

  // UPDATE PROMO BANNER
  @Put('promo-banners/:id')
  @Permission(Action.BANNER_MANAGE)
  updatePromoBanner(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePromoBannerDto,
    @Req() req: any,
  ) {
    return this.cmsService.updatePromoBanner(id, dto, req?.user?.userId);
  }

  // DELETE PROMO BANNER
  @Delete('promo-banners/:id')
  @Permission(Action.BANNER_MANAGE)
  removePromoBanner(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.cmsService.removePromoBanner(id, req?.user?.userId);
  }

  // CREATE PROMO BANNER
  @Post('promo-banners')
  @Permission(Action.BANNER_MANAGE)
  createPromoBanner(@Body() dto: CreatePromoBannerDto) {
    // console.log(dto);
    return this.cmsService.createPromoBanner(dto);
  }

  ///////////////////
  /////////USER//////
  //////////////////
}
