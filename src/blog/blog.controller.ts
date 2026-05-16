/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BlogsService } from './blog.service';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Permission } from 'src/permission/permission.decorator';
import { Action } from 'src/permission/action.enum';

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

  @Get('admin/all')
  getAllAdmin(
    @Query('activeCategory') activeCategory?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('published') published?: string,
  ) {
    const category =
      activeCategory && activeCategory !== 'null' ? activeCategory : null;

    const publishedFilter =
      published === 'true' ? true : published === 'false' ? false : null;

    return this.service.getAllAdmin({
      category,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
      search: search || '',
      published: publishedFilter,
    });
  }

  @Get('categories')
  getCategories() {
  // console.log('here');
    return this.service.getCategories();
  }

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.BLOG_CREATE)
  getBlogById(@Param('id') id: string) {
    return this.service.getBlogById(parseInt(id));
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.BLOG_UPDATE)
  updateBlog(
    @Param('id') id: string,
    @Body() dto: UpdateBlogDto,
    @Req() req: any,
  ) {
    return this.service.updateBlog(
      parseInt(id),
      dto,
      req?.user?.userId as number,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Permission(Action.BLOG_DELETE)
  deleteBlog(@Param('id') id: string, @Req() req: any) {
    return this.service.deleteBlog(parseInt(id), req?.user?.userId);
  }

  @Get('/:blogSlug')
  getBlogBySlug(@Param('blogSlug') slug: string) {
    return this.service.getBlogBySlug(slug);
  }
}
