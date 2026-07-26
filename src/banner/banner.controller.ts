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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BroadBannerService } from './banner.service';
import { Permission } from 'src/permission/permission.decorator';
import { Action } from 'src/permission/action.enum';

@Controller('banners')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BannerController {
  constructor(private readonly broadBannerService: BroadBannerService) {}

  @Post('broad-banner')
  @HttpCode(HttpStatus.CREATED)
  @Permission(Action.BANNER_MANAGE)
  create(@Body() dto: CreateBroadBannerDto, @Req() req: any) {
    return this.broadBannerService.create(dto, req?.user?.userId);
  }

  @Get('broad-banner/all')
  @Permission(Action.BANNER_MANAGE)
  findAll() {
    return this.broadBannerService.findAll();
  }

  @Patch('broad-banner/:id')
  @Permission(Action.BANNER_MANAGE)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBroadBannerDto,
    @Req() req: any,
  ) {
    return this.broadBannerService.update(id, dto, req?.user?.userId);
  }

  @Delete('broad-banner/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permission(Action.BANNER_MANAGE)
  remove(@Param('id') id: string, @Req() req: any) {
    return this.broadBannerService.remove(id, req?.user?.userId);
  }
}
