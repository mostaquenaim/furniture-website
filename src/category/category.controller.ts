import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { CategoryService } from './category.service';

@Controller('')
export class CategoryController {
  constructor(private readonly service: CategoryService) {}

  // =====================
  // SERIES
  // =====================

  @Get('series')
  getAllSeries() {
    return this.service.getAllSeries(false, true);
  }

  @Get('series/with-relations')
  getAllSeriesWithRelations() {
    return this.service.getAllSeries(true, true);
  }

  @Get('series/:id')
  getSeries(@Param('id', ParseIntPipe) id: number) {
    return this.service.getSeriesById(id);
  }

  // =====================
  // CATEGORY
  // =====================

  @Get('categories')
  getAllCategories() {
    return this.service.getAllActiveCategories(false);
  }

  @Get('categories/with-relations')
  getAllCategoriesWithRelations() {
    return this.service.getAllActiveCategories(true);
  }

  @Get('series/:seriesId/categories')
  getCategoriesBySeries(@Param('seriesId', ParseIntPipe) seriesId: number) {
    return this.service.getCategoriesBySeries(seriesId);
  }

  @Get('category/:id')
  getCategory(@Param('id', ParseIntPipe) id: number) {
    return this.service.getCategoryById(id);
  }

  @Get('category/:id/parent')
  getCategoryParent(@Param('id', ParseIntPipe) id: number) {
    return this.service.getCategoryParent(id);
  }

  // =====================
  // SUBCATEGORY
  // =====================

  @Get('subcategory')
  getAllSubCategories() {
    return this.service.getAllActiveSubCategories(false);
  }

  @Get('subcategories/with-relations')
  getAllSubCategoriesWithRelations() {
    return this.service.getAllActiveSubCategories(true);
  }

  @Get('category/:categoryId/subcategories')
  getSubCategoriesByCategory(
    @Param('categoryId', ParseIntPipe) categoryId: number,
  ) {
    return this.service.getSubCategoriesByCategory(categoryId);
  }

  @Get('subcategory/:id')
  getSubCategory(@Param('id', ParseIntPipe) id: number) {
    return this.service.getSubCategoryById(id);
  }

  @Get('subcategory/:id/parent')
  getSubCategoryParent(@Param('id', ParseIntPipe) id: number) {
    return this.service.getSubCategoryParent(id);
  }
}
