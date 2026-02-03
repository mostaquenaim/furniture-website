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
    @Query('sortBy') sortBy?: string,
    @Query('order') order: 'asc' | 'desc' = 'asc',
  ) {
    console.log(sortBy, order, 'sortBy', 'order');
    return this.productService.getAllProducts({
      page: Number(page) || 1,
      limit: Number(limit) || 10,
      search,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      orderBy: sortBy ? { [sortBy]: order } : undefined,
    });
  }

  // you may also like / recommended / related products
  @Get('you-may-also-like/:productSlug')
  async youMayAlsoLike(@Param('productSlug') productSlug: string) {
    console.log(productSlug, 'slugg');
    return this.productService.youMayAlsoLike(productSlug);
  }

  // product reviews
  @Get('review/:slug')
  async getProductReviews(@Param('slug') slug: string) {
    console.log('slug/review');
    return this.productService.getProductReviews(slug);
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
