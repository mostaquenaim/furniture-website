/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import { UrgencyBannerService } from './urgency-banner.service';
import { CreateUrgencyBannerDto } from './dto/create-urgency-banner.dto';
import { UpdateUrgencyBannerDto } from './dto/update-urgency-banner.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Permission } from '../permission/permission.decorator';
import { Action } from '../permission/action.enum';

@Controller('urgency-banners')
export class UrgencyBannerController {
  constructor(private readonly service: UrgencyBannerService) {}

  /** Public — current active banner (within date window) */
  @Get('active')
  findActive() {
    return this.service.findActive();
  }

  /** Admin — all banners */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.BANNER_MANAGE)
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.BANNER_MANAGE)
  create(@Body() dto: CreateUrgencyBannerDto, @Req() req: any) {
    return this.service.create(dto, req?.user?.userId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.BANNER_MANAGE)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUrgencyBannerDto,
    @Req() req: any,
  ) {
    return this.service.update(id, dto, req?.user?.userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.BANNER_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.remove(id, req?.user?.userId);
  }
}
