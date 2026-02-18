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

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(
    private readonly blogService: BlogsService,
    private readonly categoryService: CategoryService,
    private readonly cmsService: CmsService,
    private readonly productService: ProductService,
  ) {}

  // ADMIN DASHBOARD BASIC INFO
  @Get('dashboard')
  getDashboard(@Req() req: any) {
    return {
      message: 'Welcome to Admin Dashboard',
    };
  }

  @Get('all-series')
  findAll() {
    return this.categoryService.getAllSeries(true);
  }

  // series, category and subcategory creation
  @Post('series')
  createSeries(@Body() createSeriesDto: CreateSeriesDto) {
    return this.categoryService.createSeries(createSeriesDto);
  }

  @Post('category')
  createCategory(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoryService.createCategory(createCategoryDto);
  }

  @Post('subcategory')
  createSubCategory(@Body() createSubCategoryDto: CreateSubCategoryDto) {
    return this.categoryService.createSubCategory(createSubCategoryDto);
  }

  // update series order
  @Patch('series/reorder')
  async reorderSeries(
    @Req() req: any,
    @Body('orders') orders: { id: number; sortOrder: number }[],
  ) {
    return await this.categoryService.reorderSeries(req?.user?.userId, orders);
  }

  // update category order
  @Patch('categories/reorder')
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
  getAdminProfile(@Req() req) {
    return req.user;
  }

  @Get('cloudinary-signature')
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
  addColor(@Body() createColorDto: CreateColorDto) {
    return this.cmsService.createColor(createColorDto);
  }

  @Delete('/colors/:colorId')
  deleteColor(@Req() req: any, @Param('colorId') colorId: number) {
    return this.cmsService.deleteColor(req?.user?.userId, colorId);
  }

  // update color
  @Patch('colors/:colorId')
  updateColor(
    @Req() req: any,
    @Param('colorId') colorId: number,
    @Body() colorDto: UpdateColorDto,
  ) {
    return this.cmsService.updateColor(req?.user?.userId, colorId, colorDto);
  }

  @Post('sizes')
  addSize(@Body() createSizeDto: CreateSizeDto) {
    return this.cmsService.createSize(createSizeDto);
  }

  // delete size
  @Delete('/sizes/:sizeId')
  deleteSize(@Req() req: any, @Param('sizeId') sizeId: number) {
    return this.cmsService.deleteSize(req?.user?.userId, sizeId);
  }

  // update size
  @Patch('sizes/:sizeId')
  updateSize(
    @Req() req: any,
    @Param('sizeId') sizeId: number,
    @Body() sizeDto: UpdateSizeDto,
  ) {
    return this.cmsService.updateSize(req?.user?.userId, sizeId, sizeDto);
  }

  @Post('variant')
  addVariant(@Body() createVariantDto: CreateVariantDto) {
    return this.cmsService.createVariant(createVariantDto);
  }

  // create new material
  @Post('materials')
  addMaterial(@Body() createMaterialDto: CreateMaterialDto) {
    return this.cmsService.addMaterial(createMaterialDto);
  }

  // update material
  @Patch('materials/:materialId')
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
  deleteMaterial(@Req() req: any, @Param('materialId') materialId: number) {
    return this.cmsService.deleteMaterial(req?.user?.userId, materialId);
  }

  //////////////////////
  ////// PRODUCT //////
  ////////////////////
  @Post('products')
  async createProduct(@Body() dto: CreateProductDto) {
    // console.log(JSON.stringify(dto, null, 2), 'dtoooo');
    // return true
    return this.productService.createProduct(dto);
  }

  @Patch('product/:productId')
  async updateProduct(
    @Param('productId') productId: string,
    @Body() dto: UpdateProductDto,
  ) {
    // console.log(JSON.stringify(dto, null, 2), 'dtoooo');
    return this.productService.updateProduct(productId, dto);
  }

  @Patch('set-trend-score')
  async setTrendScore() {
    return this.productService.setTrendScore();
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
  async createBlog(@Body() dto: CreateBlogDto) {
    // console.log(JSON.stringify(dto, null, 2), 'dtoooo');
    return this.blogService.createBlog(dto);
  }

  @Post('blog-categories')
  async createBlogCategory(@Body() dto: CreateBlogCategoryDto) {
    // console.log('DTO:', dto);
    return this.blogService.createBlogCategory(dto);
  }

  //////////////////////
  ////// ORDER //////
  ////////////////////

  //create coupons
  @Post('create-coupon')
  async createCoupon(@Body() dto: CreateCouponDto) {
    return await this.cmsService.createCoupon(dto);
  }

  @Post('create-mock-coupons')
  async createMockCoupons() {
    return this.cmsService.createMockCoupons();
  }

  //////////////////////
  ////// OTHERS //////
  ////////////////////

  ///DISTRICTS///
  @Post('create-initial-districts')
  async createInitialDistrict(@Req() req: any) {
    return this.cmsService.createInitialDistrict(req?.user?.userId);
  }

  @Post('create-districts')
  async createDistrict(
    @Req() req: any,
    @Body() districtDto: CreateDistrictDto,
  ) {
    return this.cmsService.createDistrict(req?.user?.userId, districtDto);
  }

  // delete coupon
  @Delete('districts/:id')
  async deleteDistrict(@Req() req: any, @Param('id') id: number) {
    return await this.cmsService.deleteDistrict(req?.user?.userId, id);
  }

  // tags
  @Post('tags')
  async createTags(@Body('name') name: string) {
    return this.cmsService.createNewTag(name);
  }

  // district id
  @Patch('districts/:id')
  async updateDistrict(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDistrictDto: UpdateDistrictDto,
  ) {
    return this.cmsService.updateDistrict(id, updateDistrictDto);
  }
}
