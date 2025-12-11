import { Controller, Get, Post, Put, Delete, Patch, Param, Body, Query, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ProductService } from './product.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { CreateVariantDto } from './dto/create-variant.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';

@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  // ===== Product CRUD =====
  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productService.createProduct(dto);
  }

  @Get()
  findAll(@Query() filters) {
    return this.productService.findAll(filters);
  }

  @Get('search')
  search(@Query('q') query: string) {
    return this.productService.search(query);
  }

  @Get('trending')
  trending() {
    return this.productService.getTrending();
  }

  @Get('featured')
  featured() {
    return this.productService.getFeatured();
  }

  @Get('flash-sales')
  flashSales() {
    return this.productService.getFlashSales();
  }

  @Get('low-stock')
  lowStock() {
    return this.productService.getLowStock();
  }

  @Get('out-of-stock')
  outOfStock() {
    return this.productService.getOutOfStock();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productService.findProductById(id);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductDto) {
    return this.productService.updateProduct(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.productService.deleteProduct(id);
  }

  // ===== Stock =====
  @Patch(':id/stock')
  updateStock(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStockDto) {
    return this.productService.updateStock(id, dto);
  }

  // ===== Variants =====
  @Post(':id/variants')
  addVariant(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateVariantDto) {
    return this.productService.addVariant(id, dto);
  }

  @Put(':id/variants/:variantId')
  updateVariant(@Param('id', ParseIntPipe) id: number, @Param('variantId', ParseIntPipe) variantId: number, @Body() dto: UpdateVariantDto) {
    return this.productService.updateVariant(id, variantId, dto);
  }

  @Delete(':id/variants/:variantId')
  deleteVariant(@Param('id', ParseIntPipe) id: number, @Param('variantId', ParseIntPipe) variantId: number) {
    return this.productService.deleteVariant(id, variantId);
  }

  // ===== Images =====
  @Get(':id/images')
  getImages(@Param('id', ParseIntPipe) id: number) {
    return this.productService.getImages(id);
  }

  @Post(':id/images')
  addImages(@Param('id', ParseIntPipe) id: number, @Body('images') images: string[]) {
    return this.productService.addImages(id, images);
  }

  @Delete('images/:imageId')
  deleteImage(@Param('imageId') imageId: string) {
    return this.productService.deleteImage(Number(imageId), imageId); // adjust as per schema
  }

  // ===== Reviews =====
  @Get(':id/reviews')
  getReviews(@Param('id', ParseIntPipe) id: number) {
    return this.productService.getReviews(id);
  }

  // ===== Similar / Related =====
  @Get(':id/similar')
  getSimilar(@Param('id', ParseIntPipe) id: number) {
    return this.productService.getSimilar(id);
  }

  @Get(':id/related')
  getRelated(@Param('id', ParseIntPipe) id: number) {
    return this.productService.getRelated(id);
  }

  // ===== Barcode =====
  @Post(':id/barcode')
  generateBarcode(@Param('id', ParseIntPipe) id: number) {
    return this.productService.generateBarcode(id);
  }
}
