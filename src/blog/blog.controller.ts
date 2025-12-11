/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { BlogsService } from './blog.service';

@Controller('blogs')
export class BlogsController {
  constructor(private readonly service: BlogsService) {}

  @Get()
  getAll() {
    return this.service.getAll();
  }

  @Post()
  create(@Body() dto: CreateBlogDto) {
    return this.service.create(dto);
  }

  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.service.getBySlug(slug);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBlogDto) {
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

  @Post(':id/products')
  linkProducts(@Param('id') id: string, @Body() body: { productIds: string[] }) {
    return this.service.linkProducts(id, body.productIds);
  }
}
