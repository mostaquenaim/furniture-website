import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { SeoService } from './seo.service';
import { CreateSeoDto } from './dto/create-seo.dto';
import { UpdateSeoDto } from './dto/update-seo.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Permission } from 'src/permission/permission.decorator';
import { Action } from 'src/permission/action.enum';

@Controller('seo')
export class SeoController {
  constructor(private readonly service: SeoService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.SEO_MANAGE)
  getAll() {
    return this.service.getAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.SEO_MANAGE)
  create(@Body() dto: CreateSeoDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.SEO_MANAGE)
  update(@Param('id') id: string, @Body() dto: UpdateSeoDto) {
    return this.service.update(id, dto);
  }

  // Public — pages fetch their own SEO metadata by URL to render meta tags.
  @Get('url/:url') getByUrl(@Param('url') url: string) {
    return this.service.getByUrl(url);
  }

  @Post('generate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.SEO_MANAGE)
  generate(@Body('url') url: string) {
    return this.service.generateSchema(url);
  }
}
