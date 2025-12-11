/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { CreateVariantDto } from './dto/create-variant.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';

@Injectable()
export class ProductService {
  constructor(private prisma: PrismaService) {}

  // ===== Product CRUD =====
  async createProduct(dto: CreateProductDto) {
    return await this.prisma.product.create({ data: dto });
  }

  findAll(filters?: any) {
    return this.prisma.product.findMany({ where: filters || {} });
  }

  findProductById(id: number) {
    return this.prisma.product.findUnique({ where: { id }, include: { variants: true, reviews: true } });
  }

  updateProduct(id: number, dto: UpdateProductDto) {
    return this.prisma.product.update({ where: { id }, data: dto });
  }

  deleteProduct(id: number) {
    return this.prisma.product.delete({ where: { id } });
  }

  // ===== Stock =====
  updateStock(id: number, dto: UpdateStockDto) {
    return this.prisma.productVariant.updateMany({ where: { productId: id }, data: { stock: dto.stock } });
  }

  getLowStock() {
    return this.prisma.productVariant.findMany({ where: { stock: { lte: 5 } } });
  }

  getOutOfStock() {
    return this.prisma.productVariant.findMany({ where: { stock: 0 } });
  }

  // ===== Variants =====
  addVariant(productId: number, dto: CreateVariantDto) {
    return this.prisma.productVariant.create({ data: { ...dto, productId } });
  }

  updateVariant(productId: number, variantId: number, dto: UpdateVariantDto) {
    return this.prisma.productVariant.update({ where: { id: variantId }, data: dto });
  }

  deleteVariant(productId: number, variantId: number) {
    return this.prisma.productVariant.delete({ where: { id: variantId } });
  }

  // ===== Images =====
  async getImages(productId: number) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    return product ? product.images : [];
  }

  addImages(productId: number, images: string[]) {
    return this.prisma.product.update({
      where: { id: productId },
      data: { images: { push: images } },
    });
  }

  async deleteImage(productId: number, image: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');
    const updatedImages = product.images.filter(img => img !== image);
    return this.prisma.product.update({ where: { id: productId }, data: { images: updatedImages } });
  }

  // ===== Reviews =====
  getReviews(productId: number) {
    return this.prisma.review.findMany({ where: { productId } });
  }

  // ===== Similar / Recommended =====
  async getSimilar(productId: number) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    return this.prisma.product.findMany({ where: { subcategoryId: product ?  product.subcategoryId : -1, NOT: { id: productId } } });
  }

  getRelated(productId: number) {
    console.log(productId);
    // placeholder logic, can use recommendation engine
    return this.prisma.product.findMany({ take: 5 });
  }

  // ===== Search / Trending / Featured / Flash =====
  search(query: string) {
    return this.prisma.product.findMany({ where: { title: { contains: query, mode: 'insensitive' } } });
  }

  getTrending() {
    return this.prisma.product.findMany({ orderBy: { reviews: { _count: 'desc' } }, take: 10 });
  }

  getFeatured() {
    return this.prisma.product.findMany({ where: { /* add featured flag in schema */ }, take: 10 });
  }

  getFlashSales() {
    return this.prisma.product.findMany({ where: { /* add flash sale flag */ }, take: 10 });
  }

  // ===== Barcode generation =====
  generateBarcode(productId: number) {
    // generate a placeholder code, you can use `bwip-js` or `jsbarcode`
    return `PROD-${productId}-${Date.now()}`;
  }
}
