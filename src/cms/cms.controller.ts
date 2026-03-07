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
  ParseIntPipe,
  UseGuards,
  Query,
  Res,
} from '@nestjs/common';
import { CmsService } from './cms.service';
import { CreateAboutDto } from './dto/create-about.dto';
import { UpdateAboutDto } from './dto/update-about.dto';
import { CreateTnCDto } from './dto/create-tnc.dto';
import { UpdateTnCDto } from './dto/update-tnc.dto';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { CreatePromoBannerDto } from './dto/create-promo-banner.dto';
import { UpdatePromoBannerDto } from './dto/update-promo-banner.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CartService } from 'src/cart/cart.service';
import { OrderService } from 'src/order/order.service';
import type { Response } from 'express';

@Controller()
export class CmsController {
  constructor(
    private readonly cmsService: CmsService,
    private readonly cartService: CartService,
    private readonly orderService: OrderService,
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

  @Post('banners')
  createBanner(@Body() dto: CreateBannerDto) {
    return this.cmsService.createBanner(dto);
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
  getActivePromoBanners() {
    return this.cmsService.findAllActivePromoBanners();
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

  //INVOICE

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
}
