/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { DiscountType } from './roles.enum';

@Injectable()
export class ProductService {
  constructor(private prisma: PrismaService) {}

  // create a product
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

    // For color variants, validate that each color has at least one size with quantity > 0
    if (dto.hasColorVariants) {
      for (const color of dto.colors) {
        if (!color.sizes || color.sizes.length === 0) {
          throw new BadRequestException(
            `Color variant must have at least one size`,
          );
        }

        // Validate that at least one size has quantity > 0
        const hasValidQuantity = color.sizes.some((size) => size.quantity > 0);
        if (!hasValidQuantity) {
          throw new BadRequestException(
            `Color variant must have at least one size with quantity greater than 0`,
          );
        }
      }
    }

    const basePrice = dto.basePrice;
    let price = basePrice;

    if (dto.discount && dto.discount > 0) {
      if (dto.discountType === DiscountType.PERCENT) {
        price = Math.round(basePrice - (basePrice * dto.discount) / 100);
      }

      if (dto.discountType === DiscountType.FIXED) {
        price = basePrice - dto.discount;
      }
    }

    // safety guard
    if (price < 0) price = 0;

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
          price,
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
          materialId: dto.materialId ?? null,
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
        for (const colorVariant of dto.colors) {
          // Create product color
          const productColor = await tx.productColor.create({
            data: {
              productId: product.id,
              colorId: colorVariant.colorId,
            },
          });

          // Create color-specific images if not using default images
          if (
            !colorVariant.useDefaultImages &&
            colorVariant.images &&
            colorVariant.images.length > 0
          ) {
            const colorImagesData = colorVariant.images.map((imageUrl) => ({
              image: imageUrl,
              productColorId: productColor.id,
            }));

            await tx.productColorImage.createMany({
              data: colorImagesData,
            });
          }

          // Create sizes with quantity
          if (colorVariant.sizes && colorVariant.sizes.length > 0) {
            // Filter out sizes with 0 or negative quantity
            const validSizes = colorVariant.sizes.filter(
              (size) => size.quantity > 0,
            );

            if (validSizes.length > 0) {
              await tx.productSize.createMany({
                data: validSizes.map((size) => {
                  let price: number | null = null;

                  if (dto.discount && dto.discount > 0 && basePrice) {
                    if (dto.discountType === DiscountType.PERCENT) {
                      price = Math.round(
                        basePrice - (basePrice * dto.discount) / 100,
                      );
                    }

                    if (dto.discountType === DiscountType.FIXED) {
                      price = basePrice - dto.discount;
                    }
                  }

                  return {
                    colorId: productColor.id,
                    sizeId: size.sizeId,
                    sku: size.sku || null,
                    basePrice:
                      size.price !== undefined && size.price !== null
                        ? Number(size.price)
                        : null,
                    price: price,
                    quantity: Number(size.quantity),
                  };
                }),
              });
            }
          }
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
                },
              },
            },
          },
        },
      });
    });
  }

  // get a product by id
  async getProductById(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        // --------------------
        // Material
        // --------------------
        material: true,
        // --------------------
        // Images
        // --------------------
        images: {
          orderBy: {
            serialNo: 'asc',
          },
        },

        // --------------------
        // CATEGORIES
        // --------------------
        subCategories: {
          include: {
            subCategory: {
              include: {
                category: {
                  include: {
                    series: true,
                  },
                },
              },
            },
          },
        },

        // --------------------
        // REVIEWS
        // --------------------
        reviews: {
          include: {
            user: true,
          },
        },

        // --------------------
        // COLORS
        // --------------------
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
              },
            },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  // get all products
  async getAllProducts({
    page = 1,
    limit = 10,
    search,
    isActive,
  }: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
  }) {
    const skip = (page - 1) * limit;

    const where: any = {};

    // if anything in search
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          // --------------------
          // Material
          // --------------------
          material: true,
          // --------------------
          // Images
          // --------------------
          images: {
            orderBy: {
              serialNo: 'asc',
            },
          },
          // --------------------
          // SubCategories
          // --------------------
          subCategories: {
            include: {
              subCategory: true,
            },
          },
          // --------------------
          // Colors
          // --------------------
          colors: {
            include: {
              color: true,
              images: true,
              sizes: {
                include: {
                  size: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // delete a product
  async deleteProduct(id: number) {
    // Delete product (cascade will handle related records)
    return await this.prisma.product.delete({
      where: { id },
    });
  }

  // toggle product status
  async toggleProductStatusBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
    });

    if (!product) {
      throw new BadRequestException('Product not found');
    }

    return await this.prisma.product.update({
      where: { slug },
      data: {
        isActive: !product.isActive,
      },
    });
  }

  // update product
  async updateProduct(slug: string, dto: UpdateProductDto) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const basePrice = dto.basePrice;
    let price = basePrice;

    if (dto.discount && dto.discount > 0 && basePrice) {
      if (dto.discountType === DiscountType.PERCENT) {
        price = Math.round(basePrice - (basePrice * dto.discount) / 100);
      }

      if (dto.discountType === DiscountType.FIXED) {
        price = basePrice - dto.discount;
      }
    }

    // safety guard
    if (price && price < 0) price = 0;

    return this.prisma.$transaction(async (tx) => {
      // Update Product Core Fields
      await tx.product.update({
        where: { id: product.id },
        data: {
          title: dto.title,
          slug: dto.slug,
          sku: dto.sku,
          description: dto.description,
          basePrice: dto.basePrice,
          price,
          hasColorVariants: dto.hasColorVariants,
          showColor: dto.showColor,
          discountType: dto.discountType,
          discount: dto.discount,
          discountStart: dto.discountStart,
          discountEnd: dto.discountEnd,
          note: dto.note,
          deliveryEstimate: dto.deliveryEstimate,
          productDetails: dto.productDetails,
          dimension: dto.dimension,
          shippingReturn: dto.shippingReturn,
          isActive: dto.isActive,
          materialId: dto.materialId || product.materialId,
        },
      });

      // Replace Images
      if (dto.images) {
        await tx.productImage.deleteMany({
          where: { productId: product.id },
        });

        await tx.productImage.createMany({
          data: dto.images.map((img, index) => ({
            productId: product.id,
            image: img.image,
            serialNo: img.serialNo ?? index + 1,
          })),
        });
      }

      // Replace SubCategories
      if (dto.subCategories) {
        await tx.productSubCategory.deleteMany({
          where: { productId: product.id },
        });

        await tx.productSubCategory.createMany({
          data: dto.subCategories.map((subCategoryId) => ({
            productId: product.id,
            subCategoryId,
          })),
        });
      }

      // Replace Colors & Sizes
      if (dto.colors) {
        // Clear old data
        await tx.productColorImage.deleteMany({
          where: { productColor: { productId: product.id } },
        });

        await tx.productSize.deleteMany({
          where: { color: { productId: product.id } },
        });

        await tx.productColor.deleteMany({
          where: { productId: product.id },
        });

        // Re-create like create flow
        for (const colorVariant of dto.colors) {
          const productColor = await tx.productColor.create({
            data: {
              productId: product.id,
              colorId: colorVariant.colorId,
              useDefaultImages: colorVariant.useDefaultImages ?? false,
            },
          });

          // Create color images (only if NOT default)
          if (
            !colorVariant.useDefaultImages &&
            colorVariant.images &&
            colorVariant.images.length > 0
          ) {
            await tx.productColorImage.createMany({
              data: colorVariant.images.map((imageUrl, index) => ({
                productColorId: productColor.id,
                image: imageUrl,
                serialNo: index + 1,
              })),
            });
          }

          // Create sizes (quantity > 0 only)
          if (colorVariant.sizes && colorVariant.sizes.length > 0) {
            const validSizes = colorVariant.sizes.filter(
              (size) => size.sku != '',
            );

            if (validSizes.length > 0) {
              await tx.productSize.createMany({
                data: validSizes.map((size) => {
                  let price: number | null = null;

                  if (dto.discount && dto.discount > 0 && basePrice) {
                    if (dto.discountType === DiscountType.PERCENT) {
                      price = Math.round(
                        basePrice - (basePrice * dto.discount) / 100,
                      );
                    }

                    if (dto.discountType === DiscountType.FIXED) {
                      price = basePrice - dto.discount;
                    }
                  }

                  return {
                    colorId: productColor.id,
                    sizeId: size.sizeId,
                    sku: size.sku || null,
                    basePrice:
                      size.price !== undefined && size.price !== null
                        ? Number(size.price)
                        : null,
                    price: price,
                    quantity: Number(size.quantity),
                  };
                }),
              });
            }
          }
        }
      }

      return tx.product.findUnique({
        where: { id: product.id },
        include: {
          images: true,
          subCategories: true,
          colors: {
            include: {
              sizes: true,
            },
          },
        },
      });
    });
  }

  // sync all products prices
  async syncAllProductPrices() {
    // Fetch all products with their color variants and sizes
    const products = await this.prisma.product.findMany({
      include: {
        colors: {
          include: {
            sizes: true,
          },
        },
      },
    });

    for (const product of products) {
      const basePrice = product.basePrice;
      let price = basePrice;

      // Update main product price
      if (product.discount && product.discount > 0) {
        if (product.discountType === DiscountType.PERCENT) {
          price = Math.round(basePrice - (basePrice * product.discount) / 100);
        } else if (product.discountType === DiscountType.FIXED) {
          price = basePrice - product.discount;
        }
      }
      if (price < 0) price = 0;

      await this.prisma.product.update({
        where: { id: product.id },
        data: { price },
      });

      // Update sizes for each color variant
      for (const color of product.colors) {
        for (const size of color.sizes) {
          const sizeBasePrice = size.price ?? basePrice; // fallback to product basePrice
          let sizePrice = sizeBasePrice;

          if (product.discount && product.discount > 0) {
            if (product.discountType === DiscountType.PERCENT) {
              sizePrice = Math.round(
                sizeBasePrice - (sizeBasePrice * product.discount) / 100,
              );
            } else if (product.discountType === DiscountType.FIXED) {
              sizePrice = sizeBasePrice - product.discount;
            }
          }
          if (sizePrice < 0) sizePrice = 0;

          await this.prisma.productSize.update({
            where: { id: size.id },
            data: { price: sizePrice },
          });
        }
      }
    }

    return { message: 'Product prices synchronized successfully' };
  }
}
