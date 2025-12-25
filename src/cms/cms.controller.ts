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

@Controller()
export class CmsController {
  constructor(private readonly cmsService: CmsService) {}

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

  // CREATE PROMO BANNER
  @Post('promo-banners')
  createPromoBanner(@Body() dto: CreatePromoBannerDto) {
    // console.log(dto);
    return this.cmsService.createPromoBanner(dto);
  }

  // GET ALL ACTIVE PROMO BANNERS (Frontend)
  @Get('promo-banners')
  getActivePromoBanners() {
    return this.cmsService.findAllActivePromoBanners();
  }

  // UPDATE PROMO BANNER
  @Put('promo-banners/:id')
  updatePromoBanner(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePromoBannerDto,
  ) {
    return this.cmsService.updatePromoBanner(id, dto);
  }

  // DELETE PROMO BANNER
  @Delete('promo-banners/:id')
  removePromoBanner(@Param('id', ParseIntPipe) id: number) {
    return this.cmsService.removePromoBanner(id);
  }

  //VARIANTS
  @Get('variant')
  getVariants() {
    return this.cmsService.getVariants();
  }

  //COLORS
  @Get('colors')
  getAllColors() {
    return this.cmsService.getAllColors();
  }
}
