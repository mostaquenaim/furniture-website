/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Controller, Get, Param, Query } from '@nestjs/common';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { BlogsService } from './blog.service';

@Controller('blogs')
export class BlogsController {
  constructor(private readonly service: BlogsService) {}

  @Get()
  getAll(
    @Query('activeCategory') activeCategory?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const category =
      activeCategory && activeCategory !== 'null' ? activeCategory : null;

    return this.service.getAll({
      category,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
      search: search || '',
    });
  }

  @Get('categories')
  getCategories() {
    console.log('here');
    return this.service.getCategories();
  }

  @Get('/:blogSlug')
  getBlogBySlug(@Param('blogSlug') slug: string) {
    return this.service.getBlogBySlug(slug);
  }
}
