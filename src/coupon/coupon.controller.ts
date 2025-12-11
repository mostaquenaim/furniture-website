import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { CouponsService } from './coupon.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

@Controller('coupons')
export class CouponsController {
  constructor(private readonly service: CouponsService) {}

  @Get()
  getAll() {
    return this.service.getAll();
  }

  @Post()
  create(@Body() dto: CreateCouponDto) {
    return this.service.create(dto);
  }

  @Get('available')
  available() {
    return this.service.getAvailableForUser();
  }

  @Get(':code')
  getByCode(@Param('code') code: string) {
    return this.service.getByCode(code);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  @Post(':id/validate')
  validate(@Param('id') id: string) {
    return this.service.validate(id);
  }
}
