import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';

@Injectable()
export class ProductService {
  constructor(private prisma: PrismaService) {}

  async createProduct(dto: CreateProductDto) {
    // Validate that at least one image exists
    if (!dto.images || dto.images.length === 0) {
      throw new BadRequestException('At least one product image is required');
    }

    // Validate subcategories
    if (!dto.subCategories || dto.subCategories.length === 0) {
      throw new BadRequestException('At least one subcategory is required');
    }

    // Validate colors if hasColorVariants is true
    if (dto.hasColorVariants && (!dto.colors || dto.colors.length === 0)) {
      throw new BadRequestException(
        'At least one color variant is required when hasColorVariants is true',
      );
    }

    // For color variants, validate that each color has at least one size
    // if (dto.hasColorVariants) {
    //   for (const color of dto.colors) {
    //     if (!color.sizes || color.sizes.length === 0) {
    //       throw new BadRequestException(
    //         `Color variant must have at least one size`,
    //       );
    //     }
    //   }
    // }

    // Use transaction to ensure all operations succeed or fail together
    return await this.prisma.$transaction(async (tx) => {
      // First, create the main product
      const product = await tx.product.create({
        data: {
          title: dto.title,
          slug: dto.slug,
          sku: dto.sku,
          description: dto.description,
          basePrice: dto.basePrice,
          hasColorVariants: dto.hasColorVariants ?? true,
          showColor: dto.showColor ?? true,
          discountType: dto.discountType,
          discount: dto.discount ?? 0,
          discountStart: dto.discountStart,
          discountEnd: dto.discountEnd,
          note: dto.note,
          deliveryEstimate: dto.deliveryEstimate,
          productDetails: dto.productDetails,
          dimension: dto.dimension,
          shippingReturn: dto.shippingReturn,
          isActive: dto.isActive ?? true,
        },
      });

      // Create product images
      if (dto.images && dto.images.length > 0) {
        await tx.productImage.createMany({
          data: dto.images.map((image) => ({
            image: image.image,
            serialNo: image.serialNo,
            productId: product.id,
          })),
        });
      }

      // Connect subcategories
      if (dto.subCategories && dto.subCategories.length > 0) {
        const subCategoryConnections = dto.subCategories.map((subCatId) => ({
          productId: product.id,
          subCategoryId: subCatId,
        }));

        await tx.productSubCategory.createMany({
          data: subCategoryConnections,
        });
      }

      // Create color variants if applicable
      if (dto.hasColorVariants && dto.colors && dto.colors.length > 0) {
        console.log('hasColorVariants');
        for (const colorVariant of dto.colors) {
          console.log(colorVariant, 'colorVariantcolorVariant');
          // Create product color
          const productColor = await tx.productColor.create({
            data: {
              productId: product.id,
              colorId: colorVariant.colorId,
            },
          });

          // console.log(
          //   colorVariant?.useDefaultImages,
          //   'colorVariant.useDefaultImages',
          //   colorVariant?.images,
          //   'colorVariant.images',
          // );

          // Create color-specific images if not using default images
          if (
            !colorVariant.useDefaultImages &&
            colorVariant.images &&
            colorVariant.images.length > 0
          ) {
            // console.log('dhukse');
            const colorImagesData = colorVariant.images.map((imageUrl) => ({
              image: imageUrl,
              productColorId: productColor.id,
            }));

            // console.log(colorImagesData, 'colorImagesData');

            await tx.productColorImage.createMany({
              data: colorImagesData,
            });
          }

          // Create sizes with stock
          // if (colorVariant.sizes && colorVariant.sizes.length > 0) {
          //   for (const size of colorVariant.sizes) {
          //     // Create product size
          //     const productSize = await tx.productSize.create({
          //       data: {
          //         sizeId: size.sizeId,
          //         colorId: productColor.id,
          //         sku: size.sku,
          //         price: size.price,
          //       },
          //     });

          //     // Create stock for this size
          //     await tx.productStock.create({
          //       data: {
          //         sizeId: productSize.id,
          //         quantity: size.stock,
          //       },
          //     });
          //   }
          // }
        }
      }

      // Return the complete product with all relations
      return await tx.product.findUnique({
        where: { id: product.id },
        include: {
          images: true,
          subCategories: {
            include: {
              subCategory: true,
            },
          },
          colors: {
            include: {
              color: true,
              images: true,
              sizes: {
                include: {
                  size: true,
                  stock: true,
                },
              },
            },
          },
        },
      });
    });
  }

  async getProductById(id: number) {
    return await this.prisma.product.findUnique({
      where: { id },
      include: {
        images: {
          orderBy: { serialNo: 'asc' },
        },
        subCategories: {
          include: {
            subCategory: {
              include: {
                category: true,
              },
            },
          },
        },
        colors: {
          include: {
            color: true,
            images: true,
            sizes: {
              include: {
                size: {
                  include: {
                    variant: true,
                  },
                },
                stock: true,
              },
            },
          },
        },
        reviews: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async deleteProduct(id: number) {
    // Delete product (cascade will handle related records)
    return await this.prisma.product.delete({
      where: { id },
    });
  }

  async toggleProductStatus(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new BadRequestException('Product not found');
    }

    return await this.prisma.product.update({
      where: { id },
      data: {
        isActive: !product.isActive,
      },
    });
  }
}
