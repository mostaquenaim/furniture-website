import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ProductService } from './product.service';

@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get('all')
  getAllProducts(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.productService.getAllProducts({
      page: Number(page) || 1,
      limit: Number(limit) || 10,
      search,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @Get(':slug')
  getProductById(@Param('slug') slug: string) {
    return this.productService.getProductById(slug);
  }

  @Patch(':productId/toggle-status')
  toggleProductStatusBySlug(@Param('productId') productId: string) {
    return this.productService.toggleProductStatusBySlug(productId);
  }

  // @Patch(':productId/toggle-status')
  // toggleProductStatusBySlug(@Param('productId') productId: string) {
  //   return this.productService.toggleProductStatusBySlug(productId);
  // }
}
