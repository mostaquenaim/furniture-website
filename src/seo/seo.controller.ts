import { Controller, Get, Post, Put, Body, Param } from '@nestjs/common';
import { SeoService } from './seo.service';
import { CreateSeoDto } from './dto/create-seo.dto';
import { UpdateSeoDto } from './dto/update-seo.dto';

@Controller('seo')
export class SeoController {
  constructor(private readonly service: SeoService) {}

  @Get() getAll() { return this.service.getAll(); }

  @Post() create(@Body() dto: CreateSeoDto) { return this.service.create(dto); }

  @Put(':id') update(@Param('id') id: string, @Body() dto: UpdateSeoDto) {
    return this.service.update(id, dto);
  }

  @Get('url/:url') getByUrl(@Param('url') url: string) { return this.service.getByUrl(url); }

  @Post('generate') generate(@Body('url') url: string) { return this.service.generateSchema(url); }
}
