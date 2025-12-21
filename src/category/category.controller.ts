import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { CategoryService } from './category.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
 
@Controller('category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  // 🌐 PUBLIC – frontend menu
  @Get('series/:seriesId')
  getBySeries(@Param('seriesId', ParseIntPipe) seriesId: number) {
    return this.categoryService.findBySeries(seriesId);
  }

  // 🔐 SUPERADMIN – all categories
  @UseGuards(JwtAuthGuard)
  @Get('all')
  findAll() {
    console.log('in');
    return this.categoryService.findAll();
  }

  // 🔐 SUPERADMIN – create category
  @UseGuards(JwtAuthGuard, RolesGuard)
  //   @Roles('SUPERADMIN')
  @Post()
  create(
    @Body()
    body: {
      slug: string;
      image?: string;
      sortOrder?: number;
      seriesId: number;
    },
  ) {
    return this.categoryService.create(body);
  }

  // 🔐 SUPERADMIN – update category
  @UseGuards(JwtAuthGuard, RolesGuard)
  //   @Roles('SUPERADMIN')
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      slug?: string;
      image?: string;
      sortOrder?: number;
      isActive?: boolean;
    },
  ) {
    return this.categoryService.update(id, body);
  }

  // 🔐 SUPERADMIN – delete category
  @UseGuards(JwtAuthGuard, RolesGuard)
  //   @Roles('SUPERADMIN')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.remove(id);
  }
}
