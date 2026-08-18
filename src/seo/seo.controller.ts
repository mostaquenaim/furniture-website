/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { SeoService } from './seo.service';
import { UpsertSeoDto } from './dto/upsert-seo.dto';
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

  // Public — pages fetch their own SEO override by URL to render meta tags.
  @Get('lookup')
  getByUrl(@Query('url') url: string) {
    return this.service.getByUrl(url);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.SEO_MANAGE)
  upsert(@Body() dto: UpsertSeoDto, @Req() req: any) {
    return this.service.upsert(dto, req?.user?.userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.SEO_MANAGE)
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.remove(id, req?.user?.userId);
  }
}
