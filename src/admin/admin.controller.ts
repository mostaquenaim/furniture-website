/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Controller, Get, UseGuards, Req, Post, Body } from '@nestjs/common';
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
import { CreateProductDto } from 'src/product/dto/create-product.dto';
import { ProductService } from 'src/product/product.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(
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

  // ADMIN PROFILE
  @Get('profile')
  getAdminProfile(@Req() req) {
    return req.user;
  }

  @Get('cloudinary-signature')
  getCloudinarySignature() {
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

  @Post('products')
  async create(@Body() dto) {
    console.log(JSON.stringify(dto, null, 2), 'dtoooo');
    return this.productService.createProduct(dto);
  }
}
