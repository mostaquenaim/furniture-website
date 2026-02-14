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
  getDashboard(@Req() req) {
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

  // ADD OTHER ATTRIBUTES
  @Post('color')
  addColor(@Body() createColorDto: CreateColorDto) {
    return this.cmsService.createColor(createColorDto);
  }

  @Post('size')
  addSize(@Body() createSizeDto: CreateSizeDto) {
    return this.cmsService.createSize(createSizeDto);
  }

  @Post('variant')
  addVariant(@Body() createVariantDto: CreateVariantDto) {
    return this.cmsService.createVariant(createVariantDto);
  }

  @Post('material')
  addMaterial(@Body() createMaterialDto: CreateMaterialDto) {
    return this.cmsService.addMaterial(createMaterialDto);
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
  @Post('create-districts')
  async createDistrict() {
    return this.cmsService.createDistrict();
  }

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
  @Post('tags')
  async createTags(@Body('name') name: string) {
    return this.cmsService.createNewTag(name);
  }
}
