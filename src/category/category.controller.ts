import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { CategoryService } from './category.service';

@Controller('')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  // =====================
  // SERIES
  // =====================
  @Get('series')
  getAllSeries() {
    return this.categoryService.getAllSeries(false, true);
  }

  @Get('series/with-relations')
  getAllSeriesWithRelations() {
    return this.categoryService.getAllSeries(true, true);
  }

  @Get('series/:id')
  getSeries(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.getSeriesById(id);
  }

  // subCategoryWise products
  @Get('series/:slug/products')
  getSeriesWiseProducts(
    @Param('slug') slug: string,

    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,

    @Query('colorIds') colorIds?: string,
    @Query('materialIds') materialIds?: string,
    @Query('subCategoryIds') subCategoryIds?: string,

    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('sortBy') sortBy?: string,
    @Query('order') order: 'asc' | 'desc' = 'asc',
  ) {
    console.log(
      'in bruh',
      colorIds,
      materialIds,
      subCategoryIds,
      minPrice,
      maxPrice,
    );

    return this.categoryService.getSeriesWiseProducts({
      slug,
      page: Number(page) || 1,
      limit: Number(limit) || 10,
      search,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,

      colorIds: colorIds ? colorIds.split(',').map(Number) : undefined,
      materialIds: materialIds ? materialIds.split(',').map(Number) : undefined,
      subCategoryIds: subCategoryIds
        ? subCategoryIds.split(',').map(Number)
        : undefined,

      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      orderBy: sortBy ? { [sortBy]: order } : { createdAt: 'desc' },
    });
  }

  @Get('series/:slug/subcategories')
  getSeriesWiseSubcategories(@Param('slug') slug: string) {
    return this.categoryService.getSeriesWiseSubcategories(slug);
  }
  // =====================
  // CATEGORY
  // =====================
  @Get('categories')
  getAllCategories() {
    return this.categoryService.getAllActiveCategories(false);
  }

  @Get('categories/with-relations')
  getAllCategoriesWithRelations() {
    return this.categoryService.getAllActiveCategories(true);
  }

  @Get('series/:seriesId/categories')
  getCategoriesBySeries(@Param('seriesId', ParseIntPipe) seriesId: number) {
    return this.categoryService.getCategoriesBySeries(seriesId);
  }

  @Get('category/:id')
  getCategory(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.getCategoryById(id);
  }

  @Get('category/:id/parent')
  getCategoryParent(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.getCategoryParent(id);
  }

  // =====================
  // SUBCATEGORY
  // =====================
  @Get('subcategory')
  getAllSubCategories() {
    return this.categoryService.getAllActiveSubCategories(false);
  }

  @Get('subcategories/with-relations')
  getAllSubCategoriesWithRelations() {
    return this.categoryService.getAllActiveSubCategories(true);
  }

  @Get('category/:categoryId/subcategories')
  getSubCategoriesByCategory(
    @Param('categoryId', ParseIntPipe) categoryId: number,
  ) {
    return this.categoryService.getSubCategoriesByCategory(categoryId);
  }

  // get subCategory by id
  @Get('subcategory/:id')
  getSubCategory(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.getSubCategoryById(id);
  }

  // get subCategory parent
  @Get('subcategory/:id/parent')
  getSubCategoryParent(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.getSubCategoryParent(id);
  }

  // subCategoryWise products
  @Get('subcategory/:slug/products')
  getSubCategoryWiseProducts(
    @Param('slug') slug: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.categoryService.getSubCategoryWiseProducts({
      page: Number(page) || 1,
      limit: Number(limit) || 10,
      search,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      slug,
    });
  }
}
