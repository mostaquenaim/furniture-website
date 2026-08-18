/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Controller,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { SeasonalCategoryService } from './seasonal-category.service';
import { CreateSeasonalCategoryDto } from './dto/create-seasonal-category.dto';
import { UpdateSeasonalCategoryDto } from './dto/update-seasonal-category.dto';
import { RolesGuard } from 'src/auth/roles.guard';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Permission } from 'src/permission/permission.decorator';
import { Action } from 'src/permission/action.enum';

@Controller('seasonal-categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SeasonalCategoryController {
  constructor(private readonly service: SeasonalCategoryService) {}

  @Post()
  @Permission(Action.SEASONAL_CATEGORY_CREATE)
  create(@Body() dto: CreateSeasonalCategoryDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @Permission(Action.SEASONAL_CATEGORY_UPDATE)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSeasonalCategoryDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permission(Action.SEASONAL_CATEGORY_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  @Put('reorder/bulk')
  @Permission(Action.SEASONAL_CATEGORY_REORDER)
  reorder(@Body('ids') ids: number[]) {
    return this.service.reorder(ids);
  }
}
