/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';

@Injectable()
export class ProductService {
  constructor(private prisma: PrismaService) {}

  async createProduct(dto: CreateProductDto) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          title: dto.title,
          slug: dto.slug,
          sku: dto.sku,
          description: dto.description,
          basePrice: dto.basePrice,
          hasColorVariants: dto.hasColorVariants,
          showColor: dto.showColor,
        },
      });

      // Product Images
      if (dto.images?.length) {
        await tx.productImage.createMany({
          data: dto.images.map((img) => ({
            ...img,
            productId: product.id,
          })),
        });
      }

      // Sub Categories
      if (dto.subCategoryIds?.length) {
        await tx.productSubCategory.createMany({
          data: dto.subCategoryIds.map((id) => ({
            productId: product.id,
            subCategoryId: id,
          })),
        });
      }

      // Colors
      for (const color of dto.colors) {
        const productColor = await tx.productColor.create({
          data: {
            productId: product.id,
            colorId: color.colorId,
          },
        });

        // Color Images
        if (color.images?.length) {
          await tx.productColorImage.createMany({
            data: color.images.map((img) => ({
              image: img,
              productColorId: productColor.id,
            })),
          });
        }

        // Sizes & Stock
        for (const size of color.sizes) {
          const productSize = await tx.productSize.create({
            data: {
              sizeId: size.sizeId,
              sku: size.sku,
              price: size.price,
              colorId: productColor.id,
            },
          });

          await tx.productStock.create({
            data: {
              sizeId: productSize.id,
              quantity: size.stock,
            },
          });
        }
      }

      return product;
    });
  }
}
