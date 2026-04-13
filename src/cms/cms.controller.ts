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
  Res,
  BadRequestException,
  ParseIntPipe,
} from '@nestjs/common';
import { CmsService } from './cms.service';
import { CreateAboutDto } from './dto/create-about.dto';
import { UpdateAboutDto } from './dto/update-about.dto';
import { CreateTnCDto } from './dto/create-tnc.dto';
import { UpdateTnCDto } from './dto/update-tnc.dto';
import { UpdateBannerDto } from './dto/Banner/update-banner.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
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

  // get tags
  @Get('tags')
  getAllTags(@Query('search') search?: string, @Query('limit') limit?: string) {
    return this.cmsService.getAllTags(
      search,
      limit ? parseInt(limit) : undefined,
    );
  }

  // About
  @Get('about')
  getAbout() {
    return this.cmsService.getAbout();
  }

  @Post('about')
  createAbout(@Body() dto: CreateAboutDto) {
    return this.cmsService.createAbout(dto);
  }

  @Put('about')
  updateAbout(@Body() dto: UpdateAboutDto) {
    return this.cmsService.updateAbout(dto);
  }

  // T&C
  @Get('tnc')
  getTnC() {
    return this.cmsService.getTnC();
  }

  @Post('tnc')
  createTnC(@Body() dto: CreateTnCDto) {
    return this.cmsService.createTnC(dto);
  }

  @Put('tnc')
  updateTnC(@Body() dto: UpdateTnCDto) {
    return this.cmsService.updateTnC(dto);
  }

  // Banners
  @Get('banners')
  getBanners() {
    return this.cmsService.getBanners();
  }

  @Put('banners/:id')
  updateBanner(@Param('id') id: string, @Body() dto: UpdateBannerDto) {
    return this.cmsService.updateBanner(id, dto);
  }

  @Delete('banners/:id')
  deleteBanner(@Param('id') id: string) {
    return this.cmsService.deleteBanner(id);
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
  getHomepageBanners(@Query('isActive') isActive?: string) {
    let parsed: boolean | undefined;

    if (isActive === 'true') parsed = true;
    else if (isActive === 'false') parsed = false;
    else parsed = undefined;

    return this.cmsService.getHomepageBanners(parsed);
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
    console.log('here');
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
  @Get('invoices/:id')
  async getInvoice(@Param('id') id: string) {
    return this.orderService.getInvoice(id);
  }

  // invoice pdf generator
  @Get('invoices/:id/pdf')
  async downloadPdf(@Param('id') id: string, @Res() res: Response) {
    return this.orderService.generateInvoicePdf(id, res);
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

  // broad banner
  /////////////

  @Get('broad-banner/active')
  findActive() {
    return this.broadBannerService.findActive();
  }

  @Get('broad-banner/:id')
  findOne(@Param('id') id: string) {
    return this.broadBannerService.findOne(id);
  }
}
