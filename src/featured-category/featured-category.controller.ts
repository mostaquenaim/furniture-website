/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
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
import { FeaturedCategoryService } from './featured-category.service';
import { CreateFeaturedCategoryDto } from './dto/create-featured-category.dto';
import { UpdateFeaturedCategoryDto } from './dto/update-featured-category.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Permission } from '../permission/permission.decorator';
import { Action } from '../permission/action.enum';

@Controller('featured-categories')
export class FeaturedCategoryController {
  constructor(private readonly service: FeaturedCategoryService) {}

  /** Public — returns up to 6 active tiles for the homepage grid */
  @Get()
  findActive() {
    return this.service.findActive();
  }

  /** Admin — returns all tiles including inactive ones */
  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.FEATURED_CATEGORY_VIEW)
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.FEATURED_CATEGORY_MANAGE)
  create(@Body() dto: CreateFeaturedCategoryDto, @Req() req: any) {
    return this.service.create(dto, req?.user?.userId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.FEATURED_CATEGORY_MANAGE)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFeaturedCategoryDto,
    @Req() req: any,
  ) {
    return this.service.update(id, dto, req?.user?.userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.FEATURED_CATEGORY_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.remove(id, req?.user?.userId);
  }

  @Patch('reorder/bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.FEATURED_CATEGORY_MANAGE)
  reorder(
    @Body() orders: { id: number; sortOrder: number }[],
    @Req() req: any,
  ) {
    return this.service.reorder(orders, req?.user?.userId);
  }
}
