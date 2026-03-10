/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { DiscountType } from './roles.enum';
import { ActivityLogService } from 'src/activity-log/activity-log.service';

@Injectable()
export class ProductService {
  constructor(
    private prisma: PrismaService,
    private activityLogService: ActivityLogService,
  ) {}

  private generateBarcodeCode(productSku: string, warehouse: string) {
    const random = Math.floor(1000 + Math.random() * 9000);
    return `SAK-${productSku}-${warehouse}-${random}`;
  }

  // create a product
  async createProduct(dto: CreateProductDto, adminId: number) {
    const existing = await this.prisma.product.findUnique({
      where: {
        slug: dto.slug,
      },
    });

    if (existing)
      throw new ConflictException('A product with similar slug exists');

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

    // Validate tags
    if (dto.tags && dto.tags.length > 10) {
      throw new BadRequestException('Maximum 10 tags allowed');
    }

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

      let totalProductQuantity = 0;

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
            // keep only sizes with stock
            const validSizes = colorVariant.sizes.filter(
              (size) => size.quantity > 0,
            );

            if (validSizes.length > 0) {
              totalProductQuantity += validSizes.reduce(
                (sum, size) => sum + Number(size.quantity),
                0,
              );

              await tx.productSize.createMany({
                data: validSizes.map((size) => {
                  const basePrice =
                    size.price !== undefined && size.price !== null
                      ? Number(size.price)
                      : null;

                  let finalPrice: number | null = basePrice || 0;

                  // SIZE LEVEL DISCOUNT
                  if (
                    basePrice &&
                    size.discount &&
                    size.discount > 0 &&
                    size.discountType
                  ) {
                    if (size.discountType === DiscountType.PERCENT) {
                      finalPrice = Math.round(
                        basePrice - (basePrice * size.discount) / 100,
                      );
                    }

                    if (size.discountType === DiscountType.FIXED) {
                      finalPrice = basePrice - size.discount;
                    }

                    // prevent negative price
                    if (finalPrice < 0) finalPrice = 0;
                  }

                  return {
                    colorId: productColor.id,
                    sizeId: size.sizeId,
                    sku: size.sku || null,

                    // original price
                    basePrice: basePrice,

                    // discounted price
                    price: finalPrice,

                    discountType: size.discountType || null,
                    discount: size.discount || dto.discount || 0,

                    quantity: Number(size.quantity),
                  };
                }),
              });
            }
          }
        }

        await tx.product.update({
          where: { id: product.id },
          data: {
            totalProductQuantity,
          },
        });
      }

      // Connect tags
      if (dto.tags && dto.tags.length > 0) {
        await tx.productTag.createMany({
          data: dto.tags.map((tagId) => ({
            productId: product.id,
            tagId,
          })),
          skipDuplicates: true,
        });
      }

      // Return the complete product with all relations
      const updatedProduct = await tx.product.findUnique({
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

      //activity log
      await this.activityLogService.log({
        adminId,
        action: 'CREATE_PRODUCT',
        module: 'PRODUCT',
        targetId: product.id,
        targetLabel: product.title,
        newValue: {
          title: product.title,
          slug: product.slug,
          sku: product.sku,
          basePrice: product.basePrice,
          price: product.price,
          discount: product.discount,
          discountType: product.discountType,
          hasColorVariants: product.hasColorVariants,
          showColor: product.showColor,
          materialId: product.materialId,
          totalProductQuantity: totalProductQuantity,
          subCategories: dto.subCategories,
          tags: dto.tags ?? [],
          colors: dto.colors?.map((c) => ({
            colorId: c.colorId,
            sizes: c.sizes?.map((s) => ({
              sizeId: s.sizeId,
              quantity: s.quantity,
              price: s.price ?? null,
            })),
          })),
        },
      });

      return updatedProduct;
    });
  }

  // get a product by id
  async getProductBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        material: {
          where: { isActive: true },
        },
        images: {
          orderBy: { serialNo: 'asc' },
        },
        subCategories: {
          include: {
            subCategory: {
              include: {
                category: {
                  include: { series: true },
                },
              },
            },
          },
        },
        colors: {
          include: {
            color: true,
            images: true,
            sizes: {
              where: {
                quantity: { gt: 0 },
                size: {
                  isActive: true,
                },
              },
              include: {
                size: {
                  include: { variant: true },
                },
              },
            },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with slug "${slug}" not found`);
    }

    product.colors = product.colors.filter((color) => color.sizes.length > 0);

    return product;
  }

  // get all products
  async getAllProducts({
    page = 1,
    limit = 10,
    search,
    isActive,
    orderBy,
    colorIds,
    materialIds,
    minPrice,
    maxPrice,
    thumb = false,
  }: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
    colorIds?: number[];
    materialIds?: number[];
    minPrice?: number;
    maxPrice?: number;
    orderBy?: Record<string, 'asc' | 'desc'>;
    thumb?: boolean;
  }) {
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        {
          productTags: {
            some: {
              tag: {
                name: { contains: search, mode: 'insensitive' },
              },
            },
          },
        },
      ];
    }

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }

    if (materialIds && materialIds?.length) {
      where.materialId = { in: materialIds };
    }

    if (colorIds && colorIds?.length) {
      where.colors = {
        some: {
          colorId: { in: colorIds },
        },
      };
    }

    if (minPrice || maxPrice) {
      where.price = {
        ...(minPrice && { gte: minPrice }),
        ...(maxPrice && { lte: maxPrice }),
      };
    }

    if (minPrice || maxPrice) {
      where.price = {
        ...(minPrice && { gte: minPrice }),
        ...(maxPrice && { lte: maxPrice }),
      };
    }

    // Always ensure product has stock
    where.totalProductQuantity = {
      gt: 0,
    };

    // --------------------------
    // Build Query Based on thumb
    // --------------------------
    const productQuery = thumb
      ? {
          where,
          skip,
          take: limit,
          orderBy: orderBy ?? { sortOrder: 'asc' },
          select: {
            id: true,
            title: true,
            slug: true,
            basePrice: true,
            price: true,
            rating: true,
            soldCount: true,
            images: {
              take: 1,
              orderBy: { serialNo: 'asc' },
              select: { image: true },
            },
          },
        }
      : {
          where,
          skip,
          take: limit,
          orderBy: orderBy ?? { sortOrder: 'asc' },
          include: {
            material: true, // If material is a single object, no 'where' allowed here
            images: {
              orderBy: { serialNo: 'asc' },
            },
            subCategories: {
              include: {
                subCategory: true, // REMOVED 'where' from here
              },
            },
            colors: {
              include: {
                color: true,
                images: true,
                sizes: {
                  where: {
                    quantity: { gt: 0 },
                    size: {
                      isActive: true,
                    },
                  },
                  include: {
                    size: {
                      include: { variant: true },
                    },
                  },
                },
              },
            },
          },
        };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.product.findMany(productQuery as any),
      this.prisma.product.count({ where }),
    ]);

    let filteredData = data;

    if (!thumb) {
      filteredData = (data as any[]).map((product) => ({
        ...product,
        colors:
          product.colors?.filter((color: any) => color.sizes?.length > 0) ?? [],
      }));
    }

    return {
      data: filteredData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
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
  async updateProduct(slug: string, dto: UpdateProductDto, adminId: number) {
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

      const updatedProduct = await tx.product.findUnique({
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

      await this.activityLogService.log({
        adminId,
        action: 'UPDATE_PRODUCT',
        module: 'PRODUCT',
        targetId: product.id,
        targetLabel: updatedProduct?.title || product.title,

        oldValue: {
          title: product.title,
          slug: product.slug,
          sku: product.sku,
          basePrice: product.basePrice,
          price: product.price,
          discount: product.discount,
          discountType: product.discountType,
          isActive: product.isActive,
          materialId: product.materialId,
        },

        newValue: {
          title: updatedProduct?.title,
          slug: updatedProduct?.slug,
          sku: updatedProduct?.sku,
          basePrice: updatedProduct?.basePrice,
          price: updatedProduct?.price,
          discount: updatedProduct?.discount,
          discountType: updatedProduct?.discountType,
          isActive: updatedProduct?.isActive,
          materialId: updatedProduct?.materialId,
        },
      });

      return updatedProduct;
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

  // sync product quantity
  async syncProductQuantity(adminId: number) {
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
      let totalProductQuantity = 0;
      for (const color of product.colors) {
        for (const size of color.sizes) {
          totalProductQuantity += size.quantity;
        }
      }

      await this.prisma.product.update({
        where: { id: product.id },
        data: {
          totalProductQuantity,
        },
      });
    }
  }

  // add product view
  async addProductView(
    productId: number,
    userId: number | null,
    visitorId: string | null,
  ) {
    if (!userId && !visitorId) return;

    const existing = await this.prisma.productView.findFirst({
      where: {
        productId,
        OR: [
          ...(userId ? [{ userId }] : []),
          ...(visitorId ? [{ visitorId }] : []),
        ],
      },
    });

    if (existing) {
      return this.prisma.productView.update({
        where: { id: existing.id },
        data: {
          viewCount: { increment: 1 },
        },
      });
    }

    return this.prisma.productView.create({
      data: {
        productId,
        userId,
        visitorId,
        viewCount: 1,
      },
    });
  }

  // you may also like
  async youMayAlsoLike(
    productSlug?: string,
    productIds?: number[],
    categorySlug?: string,
    catIds?: number[],
  ) {
    // Find the source product with its subcategories and material
    const sourceProduct = await this.prisma.product.findUnique({
      where: { slug: productSlug, isActive: true },
      select: {
        id: true,
        materialId: true,
        subCategories: {
          select: {
            subCategoryId: true,
            subCategory: {
              select: {
                categoryId: true,
                category: {
                  select: {
                    seriesId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!sourceProduct) {
      return [];
    }

    const excludeIds = [
      sourceProduct.id,
      ...(productIds?.length ? productIds : []),
    ];

    const subCategoryIds = sourceProduct.subCategories.map(
      (sc) => sc.subCategoryId,
    );

    const categoryIds = [
      ...new Set(
        sourceProduct.subCategories.map((sc) => sc.subCategory.categoryId),
      ),
    ];

    const seriesIds = [
      ...new Set(
        sourceProduct.subCategories.map(
          (sc) => sc.subCategory.category.seriesId,
        ),
      ),
    ];

    // Step 1: Find products from same subcategories or material
    let relatedProducts = await this.prisma.product.findMany({
      where: {
        isActive: true,
        id: { notIn: excludeIds },
        OR: [
          {
            subCategories: {
              some: {
                subCategoryId: { in: subCategoryIds },
              },
            },
          },
          ...(sourceProduct.materialId
            ? [{ materialId: sourceProduct.materialId }]
            : []),
        ],
      },
      take: 8,
      orderBy: [
        { isFeatured: 'desc' },
        { rating: 'desc' },
        { soldCount: 'desc' },
      ],
      select: {
        id: true,
        title: true,
        slug: true,
        images: {
          select: {
            id: true,
            image: true,
            serialNo: true,
          },
        },
      },
    });

    // Step 2: If less than 6, fetch from same categories
    if (relatedProducts.length < 6 && categoryIds.length > 0) {
      const existingIds = relatedProducts.map((p) => p.id);

      const categoryProducts = await this.prisma.product.findMany({
        where: {
          isActive: true,
          id: {
            notIn: [...excludeIds, ...existingIds],
          },
          subCategories: {
            some: {
              subCategory: {
                categoryId: { in: categoryIds },
              },
            },
          },
        },
        take: 8 - relatedProducts.length,
        orderBy: [
          { isFeatured: 'desc' },
          { rating: 'desc' },
          { soldCount: 'desc' },
        ],
        select: {
          id: true,
          title: true,
          slug: true,
          images: {
            select: {
              id: true,
              image: true,
              serialNo: true,
            },
          },
        },
      });

      relatedProducts = [...relatedProducts, ...categoryProducts];
    }

    // Step 3: If still less than 6, fetch from same series
    if (relatedProducts.length < 6 && seriesIds.length > 0) {
      const existingIds = relatedProducts.map((p) => p.id);

      const seriesProducts = await this.prisma.product.findMany({
        where: {
          isActive: true,
          id: {
            notIn: [...excludeIds, ...existingIds],
          },
          subCategories: {
            some: {
              subCategory: {
                category: {
                  seriesId: { in: seriesIds },
                },
              },
            },
          },
        },
        take: 8 - relatedProducts.length,
        orderBy: [
          { isFeatured: 'desc' },
          { rating: 'desc' },
          { soldCount: 'desc' },
        ],
        select: {
          id: true,
          title: true,
          slug: true,
          images: {
            select: {
              id: true,
              image: true,
              serialNo: true,
            },
          },
        },
      });

      relatedProducts = [...relatedProducts, ...seriesProducts];
    }

    // Step 4: If still less than 6, fetch any popular products
    if (relatedProducts.length < 6) {
      const existingIds = relatedProducts.map((p) => p.id);

      const popularProducts = await this.prisma.product.findMany({
        where: {
          isActive: true,
          id: {
            notIn: [...excludeIds, ...existingIds],
          },
        },
        take: 8 - relatedProducts.length,
        orderBy: [
          { isFeatured: 'desc' },
          { rating: 'desc' },
          { soldCount: 'desc' },
        ],
        select: {
          id: true,
          title: true,
          slug: true,
          images: {
            select: {
              id: true,
              image: true,
              serialNo: true,
            },
          },
        },
      });

      relatedProducts = [...relatedProducts, ...popularProducts];
    }

    return relatedProducts;
  }

  // get recommended products by category
  async getSubCategoryBasedRecommendations(
    subCategorySlug?: string,
    subCategoryIds?: number[],
    productIds?: number[],
  ) {
    const ids: number[] = subCategoryIds || [];

    if (subCategorySlug) {
      const sub = await this.prisma.subCategory.findUnique({
        where: { slug: subCategorySlug },
        select: { id: true },
      });

      if (sub) ids.push(sub.id);
    }

    const excludeIds = productIds?.length ? productIds : [];

    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        id: { notIn: excludeIds },

        subCategories: {
          some: {
            subCategoryId: { in: ids },
          },
        },
      },

      take: 8,

      orderBy: [
        { isFeatured: 'desc' },
        { rating: 'desc' },
        { soldCount: 'desc' },
      ],

      select: {
        id: true,
        title: true,
        slug: true,
        images: {
          select: {
            id: true,
            image: true,
            serialNo: true,
          },
        },
      },
    });

    return products;
  }

  // get recommended products
  async recommendedProducts(userId: number | null, limit: number = 10) {
    let allInteractedIds: number[] = [];
    let subCategoryIds: number[] = [];
    let categoryIds: number[] = [];

    if (userId) {
      const [orders, cartItems, wishlist, views] = await Promise.all([
        this.prisma.order.findMany({
          where: { userId },
          take: 5,
          select: { items: { select: { productId: true } } },
        }),
        this.prisma.cartItem.findMany({
          where: { cart: { userId } },
          select: {
            productSize: { select: { color: { select: { productId: true } } } },
          },
        }),
        this.prisma.wishlist.findMany({
          where: { userId },
          select: { productId: true },
        }),
        this.prisma.productView.findMany({
          where: { userId },
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: { productId: true },
        }),
      ]);

      const viewedIds = views.map((v) => v.productId);
      const cartIds = cartItems.map((c) => c.productSize.color.productId);
      const wishlistIds = wishlist.map((w) => w.productId);
      const purchasedIds = orders.flatMap((o) =>
        o.items.map((i) => i.productId),
      );

      allInteractedIds = [
        ...new Set([...viewedIds, ...cartIds, ...wishlistIds, ...purchasedIds]),
      ];

      // 3. Extract Subcategories & Categories to build "Interest Map"
      const interactions = await this.prisma.productSubCategory.findMany({
        where: { productId: { in: allInteractedIds } },
        select: {
          subCategoryId: true,
          subCategory: { select: { categoryId: true } },
        },
      });

      subCategoryIds = [...new Set(interactions.map((i) => i.subCategoryId))];
      categoryIds = [
        ...new Set(interactions.map((i) => i.subCategory.categoryId)),
      ];
    }

    let recommendations: any[] = [];

    // 4. Waterfall Strategy

    // Step 1: Personalized High-Intent Matches
    if (subCategoryIds.length > 0) {
      recommendations = await this.prisma.product.findMany({
        where: {
          isActive: true,
          id: { notIn: allInteractedIds },
          subCategories: { some: { subCategoryId: { in: subCategoryIds } } },
        },
        take: limit,
        orderBy: [{ trendScore: 'desc' }, { isFeatured: 'desc' }],
        select: this.recommendationSelect,
      });
    }

    // Step 2: Category-Level Discovery
    if (recommendations.length < limit && categoryIds.length > 0) {
      const existingIds = recommendations.map((r) => r.id);
      const categoryMatches = await this.prisma.product.findMany({
        where: {
          isActive: true,
          id: { notIn: [...allInteractedIds, ...existingIds] },
          subCategories: {
            some: { subCategory: { categoryId: { in: categoryIds } } },
          },
        },
        take: limit - recommendations.length,
        orderBy: [{ trendScore: 'desc' }, { soldCount: 'desc' }],
        select: this.recommendationSelect,
      });
      recommendations = [...recommendations, ...categoryMatches];
    }

    // Step 3: Global Trends & Randomization
    if (recommendations.length < limit) {
      const existingIds = recommendations.map((r) => r.id);
      const trending = await this.prisma.product.findMany({
        where: {
          isActive: true,
          id: { notIn: [...allInteractedIds, ...existingIds] },
        },
        take: limit - recommendations.length + 5, // Take a few extra to shuffle
        orderBy: [{ trendScore: 'desc' }, { createdAt: 'desc' }],
        select: this.recommendationSelect,
      });

      // Shuffle the trending items so the user doesn't see the same "Fillers"
      const shuffled = trending
        .sort(() => 0.5 - Math.random())
        .slice(0, limit - recommendations.length);
      recommendations = [...recommendations, ...shuffled];
    }

    return recommendations;
  }

  // recently viewed products
  async recentlyViewed(
    userId: number | null,
    visitorId: string | null,
    limit: number = 10,
  ) {
    if (!userId && !visitorId) {
      return []; // no identity → nothing to show
    }

    // Fetch unique recently viewed products
    const views = await this.prisma.productView.findMany({
      where: {
        OR: [
          ...(userId ? [{ userId }] : []),
          ...(visitorId ? [{ visitorId }] : []),
        ],
        product: {
          isActive: true,
        },
      },
      orderBy: {
        updatedAt: 'desc', // latest interaction first
      },
      distinct: ['productId'], // avoid duplicate products
      take: limit,
      include: {
        product: {
          select: {
            id: true,
            title: true,
            slug: true,
            price: true,
            basePrice: true,
            rating: true,
            images: {
              orderBy: { serialNo: 'asc' },
              take: 1,
              select: {
                id: true,
                image: true,
              },
            },
          },
        },
      },
    });

    // Filter out null products (in case product became inactive)
    const products = views.map((v) => v.product).filter((p) => p !== null);

    return products;
  }

  // Reusable Select Object
  private get recommendationSelect() {
    return {
      id: true,
      title: true,
      slug: true,
      price: true,
      basePrice: true,
      rating: true,
      images: {
        where: { serialNo: 1 },
        select: { image: true },
      },
    };
  }

  // set trend-score
  async setTrendScore(adminId: number) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Fetch all active products
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    for (const product of products) {
      // Sales in last 7 days
      const salesLast7Days = await this.prisma.orderItem.count({
        where: {
          productId: product.id,
          order: {
            createdAt: { gte: sevenDaysAgo },
            status: { in: ['CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED'] },
          },
        },
      });

      // Views in last 7 days
      const viewsLast7DaysAgg = await this.prisma.productView.aggregate({
        where: {
          productId: product.id,
          createdAt: { gte: sevenDaysAgo },
        },
        _sum: { viewCount: true },
      });
      const viewsLast7Days = viewsLast7DaysAgg._sum.viewCount ?? 0;

      // Wishlist adds in last 7 days
      const wishlistAddsLast7Days = await this.prisma.wishlist.count({
        where: {
          productId: product.id,
          createdAt: { gte: sevenDaysAgo },
          isActive: true,
        },
      });

      // Calculate trendScore
      const trendScore =
        salesLast7Days * 5 + viewsLast7Days * 1 + wishlistAddsLast7Days * 2;

      // Update product
      await this.prisma.product.update({
        where: { id: product.id },
        data: { trendScore },
      });
    }

    console.log('Trend scores updated for all products!');
  }

  // get product's all reviews
  async getProductReviews({
    productSlug,
    minRating,
    maxRating,
    isHidden,
    isFeatured,
    fromDate,
    toDate,
    adminId,
    customerId,
  }: {
    productSlug?: string;
    minRating?: number;
    maxRating?: number;
    isHidden?: boolean;
    isFeatured?: boolean;
    fromDate?: Date;
    toDate?: Date;
    adminId?: number;
    customerId?: number;
  }) {
    // Find product if slug provided
    let productId: number | undefined;
    if (productSlug) {
      const product = await this.prisma.product.findUnique({
        where: { slug: productSlug },
        select: { id: true },
      });

      if (!product) throw new NotFoundException('Product not found');
      productId = product.id;
    }

    // Build Prisma filters
    const filters: any = {
      isHidden,
      ...(typeof isFeatured === 'boolean' ? { isFeatured } : {}),
      ...(minRating !== undefined || maxRating !== undefined
        ? {
            rating: {
              ...(minRating !== undefined ? { gte: minRating } : {}),
              ...(maxRating !== undefined ? { lte: maxRating } : {}),
            },
          }
        : {}),
      ...(fromDate || toDate
        ? {
            createdAt: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
      ...(productId ? { orderItem: { productId } } : {}),
    };

    // Fetch reviews with user info
    const reviews = await this.prisma.review.findMany({
      where: filters,
      include: {
        orderItem: {
          include: {
            order: {
              select: {
                user: { select: { id: true, name: true } },
              },
            },
            product: {
              select: {
                id: true,
                slug: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Flatten user for frontend
    const formattedReviews = reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      isHidden: r.isHidden,
      isFeatured: r.isFeatured,
      createdAt: r.createdAt,
      user: r.orderItem?.order?.user ?? { id: null, name: 'Anonymous' },
    }));

    const ratingCount = formattedReviews.length;
    const averageRating =
      ratingCount > 0
        ? formattedReviews.reduce((sum, r) => sum + r.rating, 0) / ratingCount
        : 0;

    return {
      reviews: formattedReviews,
      ratingCount,
      averageRating: Number(averageRating.toFixed(1)),
    };
  }

  // update review
  async updateReview(
    id: number,
    data: { isHidden?: boolean; isFeatured?: boolean },
    adminId: number,
  ) {
    // 1. Fetch existing review
    const review = await this.prisma.review.findUnique({
      where: { id },
      include: {
        orderItem: {
          select: {
            product: {
              select: {
                title: true,
              },
            },
          },
        },
      },
    });
    if (!review) throw new NotFoundException(`Review with ID ${id} not found`);

    // 2. Enforce business rule: cannot be hidden and featured at the same time
    if (data.isHidden && data.isFeatured) {
      throw new BadRequestException(
        'A review cannot be hidden and featured at the same time',
      );
    }
    if (data.isHidden && review.isFeatured) {
      // if hiding, unfeature
      data.isFeatured = false;
    }
    if (data.isFeatured && review.isHidden) {
      // if featuring, unhide
      data.isHidden = false;
    }

    // 3. Update
    const updated = await this.prisma.review.update({
      where: { id },
      data: {
        ...(data.isHidden !== undefined && { isHidden: data.isHidden }),
        ...(data.isFeatured !== undefined && { isFeatured: data.isFeatured }),
      },
    });

    // 4. Log activity
    await this.activityLogService.log({
      adminId,
      action: 'UPDATE_REVIEW',
      module: 'PRODUCT',
      targetId: review.id,
      targetLabel: review.orderItem.product.title, // or any label you want
      oldValue: { isHidden: review.isHidden, isFeatured: review.isFeatured },
      newValue: { isHidden: updated.isHidden, isFeatured: updated.isFeatured },
    });

    return updated;
  }
}
