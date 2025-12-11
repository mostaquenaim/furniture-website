import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { FaqService } from './faq.service';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';

@Controller('faq')
export class FaqController {
  constructor(private readonly service: FaqService) {}

  @Get() getAll() { return this.service.getAll(); }

  @Post() create(@Body() dto: CreateFaqDto) { return this.service.create(dto); }

  @Put(':id') update(@Param('id') id: string, @Body() dto: UpdateFaqDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id') delete(@Param('id') id: string) { return this.service.delete(id); }
}
