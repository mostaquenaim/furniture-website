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
import { FlashSalesService } from './flash-sales.service';
import { CreateFlashSaleDto } from './dto/create-flash-sale.dto';
import { UpdateFlashSaleDto } from './dto/update-flash-sale.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Permission } from '../permission/permission.decorator';
import { Action } from '../permission/action.enum';

@Controller('flash-sales')
export class FlashSalesController {
  constructor(private readonly service: FlashSalesService) {}

  /** Public — the current live campaign (within date window) */
  @Get('active')
  findActive() {
    return this.service.findActive();
  }

  /** Admin — all campaigns */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.FLASH_SALE_MANAGE)
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.FLASH_SALE_MANAGE)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.FLASH_SALE_MANAGE)
  create(@Body() dto: CreateFlashSaleDto, @Req() req: any) {
    return this.service.create(dto, req?.user?.userId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.FLASH_SALE_MANAGE)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFlashSaleDto,
    @Req() req: any,
  ) {
    return this.service.update(id, dto, req?.user?.userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.FLASH_SALE_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.remove(id, req?.user?.userId);
  }
}
