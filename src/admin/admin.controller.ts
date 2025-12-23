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

@Controller('')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly categoryService: CategoryService) {}

  // 🔐 ADMIN DASHBOARD BASIC INFO
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

  // 🔐 ADMIN PROFILE
  @Get('profile')
  getAdminProfile(@Req() req) {
    return req.user;
  }

  @Get('cloudinary-signature')
  getCloudinarySignature() {
    const timestamp = Math.round(new Date().getTime() / 1000);

    const signature = cloudinary.utils.api_sign_request(
      { timestamp },
      process.env.CLOUDINARY_API_SECRET || '',
    );

    return {
      signature,
      timestamp,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      upload_preset: process.env.CLOUDINARY_UPLOAD_PRESET,
    };
  }
}
