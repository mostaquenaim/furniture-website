/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';

import { CreateBroadBannerDto } from './dto/create-broad-banner.dto';
import { UpdateBroadBannerDto } from './dto/update-broad-banner.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // Example Guard
import { RolesGuard } from '../auth/guards/roles.guard'; // Example Guard
import { BroadBannerService } from './banner.service';

@Controller('banners')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BannerController {
  constructor(
    private readonly bannerService: BroadBannerService,
    private readonly broadBannerService: BroadBannerService,
  ) {}

  @Post('broad-banner')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateBroadBannerDto, @Req() req: any) {
    return this.broadBannerService.create(dto, req?.user?.userId);
  }

  @Get('broad-banner/all')
  findAll() {
    return this.broadBannerService.findAll();
  }

  @Patch('broad-banner/:id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBroadBannerDto,
    @Req() req: any,
  ) {
    return this.broadBannerService.update(id, dto, req?.user?.userId);
  }

  @Delete('broad-banner/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Req() req: any) {
    return this.broadBannerService.remove(id, req?.user?.userId);
  }
}
