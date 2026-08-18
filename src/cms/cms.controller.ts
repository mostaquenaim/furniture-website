/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
  Req,
  Res,
  BadRequestException,
  ParseIntPipe,
} from '@nestjs/common';
import { CmsService } from './cms.service';
import { ValidateCouponDto } from './dto/Coupon/validate-coupon.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from 'src/auth/guards/optional-jwt-auth.guard';
import { UserRole } from '@prisma/client';
import { OrderService } from 'src/order/order.service';
import type { Response } from 'express';
import { CourierService } from 'src/courier/services/courier.service';
import { SeasonalCategoryService } from 'src/seasonal-category/seasonal-category.service';
import { HomepageGalleryService } from 'src/homepage-gallery/homepage-gallery.service';
import { BroadBannerService } from 'src/banner/banner.service';

@Controller()
export class CmsController {
  constructor(
    private readonly cmsService: CmsService,
    private readonly orderService: OrderService,
    private readonly courierService: CourierService,
    private readonly seasonalCategoryService: SeasonalCategoryService,
    private readonly homepageGalleryService: HomepageGalleryService,
    private readonly broadBannerService: BroadBannerService,
  ) {}

  // Validate a coupon code — public storefront endpoint (guest or logged-in
  // customer), so it must not sit behind the admin JWT/permission guards.
  @Post('coupons/validate')
  validateCoupon(@Body() dto: ValidateCouponDto) {
    return this.cmsService.validateCoupon(dto.code, dto.orderValue);
  }

  // get tags
  @Get('tags')
  getAllTags(@Query('search') search?: string, @Query('limit') limit?: string) {
    return this.cmsService.getAllTags(
      search,
      limit ? parseInt(limit) : undefined,
    );
  }

  // GET ALL ACTIVE PROMO BANNERS (Frontend)
  @Get('promo-banners')
  getPromoBanners(@Query('isActive') isActive?: string) {
    let parsed: boolean | undefined;

    if (isActive === 'true') parsed = true;
    else if (isActive === 'false') parsed = false;
    else parsed = undefined;

    return this.cmsService.findAllPromoBanners(parsed);
  }

  // Banners
  @Get('homepage-banners')
  getHomepageBanners(
    @Query('isActive') isActive?: string,
    @Query('device') device?: string,
  ) {
    let parsed: boolean | undefined;

    if (isActive === 'true') parsed = true;
    else if (isActive === 'false') parsed = false;
    else parsed = true; // default to active-only for public storefront

    let parsedDevice: 'DESKTOP' | 'MOBILE' | undefined;
    if (device === 'DESKTOP' || device === 'MOBILE') parsedDevice = device;

    return this.cmsService.getHomepageBanners(parsed, parsedDevice);
  }

  // VARIANTS
  @Get('variants')
  getVariants(
    @Query('isActive') isActive?: string,
    @Query('needSizes') needSizes?: string,
  ) {
    let parsedActive: boolean | null | undefined;

    if (isActive === 'true') parsedActive = true;
    else if (isActive === 'false') parsedActive = false;
    else if (isActive === 'null') parsedActive = null;
    else parsedActive = undefined;

    let parsedSize: boolean | null | undefined;

    if (needSizes === 'true') parsedSize = true;
    else if (needSizes === 'false') parsedSize = false;
    else parsedSize = undefined;

    return this.cmsService.getVariants(parsedActive, parsedSize);
  }

  // SIZES
  @Get('sizes')
  getSizes(@Query('isActive') isActive?: string) {
    let parsed: boolean | null | undefined;

    if (isActive === 'true') parsed = true;
    else if (isActive === 'false') parsed = false;
    else if (isActive === 'null') parsed = null;
    else parsed = undefined;

    return this.cmsService.getSizes(parsed);
  }

  // COLORS
  @Get('colors')
  getAllColors(@Query('isActive') isActive?: string) {
    let parsed: boolean | null | undefined;

    if (isActive === 'true') parsed = true;
    else if (isActive === 'false') parsed = false;
    else if (isActive === 'null') parsed = null;
    else parsed = undefined;

    return this.cmsService.getAllColors(parsed);
  }

  // MATERIALS
  @Get('materials')
  getAllMaterials(@Query('isActive') isActive?: string) {
    let parsed: boolean | null | undefined;

    if (isActive === 'true') parsed = true;
    else if (isActive === 'false') parsed = false;
    else if (isActive === 'null') parsed = null;
    else parsed = undefined;

    return this.cmsService.getAllMaterials(parsed);
  }

  // DISTRICTS
  @UseGuards(JwtAuthGuard)
  @Get('districts')
  async getDistricts() {
    return this.cmsService.getDistricts();
  }

  @UseGuards(JwtAuthGuard)
  @Get('zones')
  async getZones(@Query('cityId') cityId: string) {
    if (!cityId) {
      throw new BadRequestException('cityId is required');
    }

    return this.courierService.getZones(Number(cityId));
  }

  @UseGuards(JwtAuthGuard)
  @Get('areas')
  async getAreas(@Query('zoneId') zoneId: string) {
    if (!zoneId) {
      throw new BadRequestException('zoneId is required');
    }

    return this.courierService.getAreas(Number(zoneId));
  }

  @UseGuards(JwtAuthGuard)
  @Post('delivery/fee')
  async getDeliveryFee(@Body() body: any) {
    const { cityId, zoneId, weight } = body;

    if (!cityId) {
      throw new BadRequestException('cityId is required');
    }

    if (!zoneId) {
      throw new BadRequestException('zoneId is required');
    }

    if (!weight || weight <= 0) {
      throw new BadRequestException('Invalid weight');
    }

    return this.courierService.calculateDeliveryFee({
      cityId: Number(cityId),
      zoneId: Number(zoneId),
      weight: Number(weight),
    });
  }

  //invoice
  @UseGuards(JwtAuthGuard)
  @Get('invoices/:id')
  async getInvoice(@Param('id') id: string, @Req() req: any) {
    return this.orderService.getInvoice(id, req.user);
  }

  // invoice pdf generator
  @UseGuards(JwtAuthGuard)
  @Get('invoices/:id/pdf')
  async downloadPdf(
    @Param('id') id: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    return this.orderService.generateInvoicePdf(id, req.user, res);
  }

  // seasonal categories
  @Get('seasonal-categories')
  findAllSeasonalCats(@Query('onlyActive') onlyActive?: string) {
    return this.seasonalCategoryService.findAll(onlyActive === 'true');
  }

  @Get('seasonal-categories/:id')
  findOneSeasonalCats(@Param('id', ParseIntPipe) id: number) {
    return this.seasonalCategoryService.findOne(id);
  }

  // homepage gallery

  // GET /homepage-gallery?onlyActive=true
  @Get('homepage-gallery')
  findAllHomepageGallery(@Query('onlyActive') onlyActive?: string) {
    return this.homepageGalleryService.findAll(onlyActive === 'true');
  }

  // GET /homepage-gallery/:id
  @Get('homepage-gallery/:id')
  findOneHomepageGallery(@Param('id', ParseIntPipe) id: number) {
    return this.homepageGalleryService.findOne(id);
  }

  // Static Pages (About, T&C, Privacy Policy, etc.)

  // Staff (non-CUSTOMER) callers see all pages by default; anonymous/customer
  // callers default to active-only so drafts aren't publicly enumerable.
  // ?onlyActive=true/false always overrides the role-based default.
  @Get('static-pages')
  @UseGuards(OptionalJwtAuthGuard)
  getAllStaticPages(@Req() req: any, @Query('onlyActive') onlyActive?: string) {
    if (onlyActive === 'true') return this.cmsService.getAllStaticPages(true);
    if (onlyActive === 'false') return this.cmsService.getAllStaticPages(false);

    const isStaff = !!req?.user?.role && req.user.role !== UserRole.CUSTOMER;
    return this.cmsService.getAllStaticPages(!isStaff);
  }

  @Get('static-pages/:slug')
  getStaticPageBySlug(@Param('slug') slug: string) {
    return this.cmsService.getStaticPageBySlug(slug);
  }

  // Terms & Conditions (staff sees all, everyone else sees active only)
  @Get('terms-and-conditions')
  @UseGuards(OptionalJwtAuthGuard)
  getAllTermsAndConditions(@Req() req: any) {
    const isStaff = !!req?.user?.role && req.user.role !== UserRole.CUSTOMER;

    return this.cmsService.getAllTermsAndConditions(!isStaff);
  }

  // broad banner
  @Get('broad-banner/active')
  findActive() {
    return this.broadBannerService.findActive();
  }

  @Get('broad-banner/:id')
  findOne(@Param('id') id: string) {
    return this.broadBannerService.findOne(id);
  }
}
