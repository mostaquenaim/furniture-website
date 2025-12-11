import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { FlashSalesService } from './flash-sales.service';
import { CreateFlashSaleDto } from './dto/create-flash.dto';
import { UpdateFlashSaleDto } from './dto/update-flash.dto';

@Controller('flash-sales')
export class FlashSalesController {
  constructor(private readonly service: FlashSalesService) {}

  @Get()
  getActive() {
    return this.service.getActive();
  }

  @Post()
  create(@Body() dto: CreateFlashSaleDto) {
    return this.service.create(dto);
  }

  @Get(':id')
  getDetails(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFlashSaleDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  @Get(':id/products')
  getProducts(@Param('id') id: string) {
    return this.service.getProducts(id);
  }
}
