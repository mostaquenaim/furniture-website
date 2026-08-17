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
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { DiscountType } from './roles.enum';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { PieceService } from 'src/piece/piece.service';
import { Prisma, UserRole } from '@prisma/client';
import {
  assertValidDiscountWindow,
  sanitizeDiscount,
} from 'src/common/utils/discount.utils';
import {
  IN_STOCK_PRODUCT_WHERE,
  IN_STOCK_SIZE_WHERE,
  filterAvailableColors,
} from 'src/common/utils/product-availability.utils';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    private prisma: PrismaService,
    private activityLogService: ActivityLogService,
    private pieceService: PieceService,
  ) {}

  // Creates one ProductSize row and, if a positive quantity was requested,
  // generates that many piece-level barcodes for it inside the same
  // transaction. Real stock (ProductSize.quantity) stays 0 — it only
  // increments once an Inventory Manager physically receives each barcode
  // (see PieceService.receiveOne/receiveBatch) — so the number an admin
  // types here is a "how many to generate" count, not a stock write.
  private async createSizeWithPieces(
    tx: Prisma.TransactionClient,
    productColorId: number,
    size: {
      sizeId: number;
      sku?: string | null;
      price?: number | null;
      discount?: number | null;
      discountType?: DiscountType | null;
      quantity: number | string;
    },
    basePriceFallback: number,
    adminId: number,
    actorRole?: UserRole,
  ): Promise<{ productSizeId: number; quantity: number }> {
    const sizeBasePrice =
      size.price !== undefined && size.price !== null
        ? Number(size.price)
        : basePriceFallback;

    let finalPrice = sizeBasePrice;
    if (size.discount && size.discount > 0 && size.discountType) {
      if (size.discountType === DiscountType.PERCENT) {
        finalPrice = Math.round(
          sizeBasePrice - (sizeBasePrice * size.discount) / 100,
        );
      }
      if (size.discountType === DiscountType.FIXED) {
        finalPrice = sizeBasePrice - size.discount;
      }
      if (finalPrice < 0) finalPrice = 0;
    }

    const requestedQuantity = Math.max(0, Number(size.quantity) || 0);

    const created = await tx.productSize.create({
      data: {
        colorId: productColorId,
        sizeId: size.sizeId,
        sku: size.sku || null,
        basePrice: sizeBasePrice,
        price: finalPrice,
        discountType: size.discountType || null,
        discount: size.discount || 0,
        quantity: 0,
      },
    });

    if (requestedQuantity > 0) {
      await this.pieceService.generatePiecesForNewSize(
        tx,
        { productSizeId: created.id, quantity: requestedQuantity },
        adminId,
        actorRole,
      );
    }

    return { productSizeId: created.id, quantity: requestedQuantity };
  }

  // Fire-and-forget search keyword logging for the "Top Searched Keywords"
  // admin report — must never block or fail the actual product search.
  private logSearchKeyword(keyword: string, resultsCount: number): void {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) return;

    this.prisma.searchLog
      .create({ data: { keyword: normalized, resultsCount } })
      .catch((err) =>
        this.logger.warn(`Failed to log search keyword: ${err.message}`),
      );
  }

  // create a product
  async createProduct(
    dto: CreateProductDto,
    adminId: number,
    actorRole?: UserRole,
  ) {
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

    // For color variants, validate that each color has at least one size configured.
    // A size's quantity may legitimately be 0 (listed but not yet in stock).
    if (dto.hasColorVariants) {
      for (const color of dto.colors) {
        if (!color.sizes || color.sizes.length === 0) {
          throw new BadRequestException(
            `Color variant must have at least one size`,
          );
        }
      }
    }

    assertValidDiscountWindow(dto.discountStart, dto.discountEnd);

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
          weight: dto.weight ?? 0.5,
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

      // Stays 0: a newly created size's real stock only becomes non-zero once
      // its generated barcodes are physically received (see
      // createSizeWithPieces below) — nothing here writes a starting count.
      const totalProductQuantity = 0;
      const piecesGenerated: {
        productSizeId: number;
        quantity: number;
      }[] = [];

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

          // Create sizes; a size may request quantity 0 (listed but not yet
          // stocked — stays a plain LEGACY_QUANTITY row) or a positive
          // quantity, which generates that many piece-level barcodes rather
          // than writing a stock number directly (see createSizeWithPieces).
          if (colorVariant.sizes && colorVariant.sizes.length > 0) {
            for (const size of colorVariant.sizes) {
              const { productSizeId, quantity } =
                await this.createSizeWithPieces(
                  tx,
                  productColor.id,
                  size,
                  dto.basePrice,
                  adminId,
                  actorRole,
                );
              if (quantity > 0) {
                piecesGenerated.push({ productSizeId, quantity });
              }
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
          piecesGenerated,
        },
      });

      return { ...updatedProduct, pieceGeneration: { generated: piecesGenerated } };
    });
  }

  // get a product by id
  async getProductBySlug(slug: string, admin = false) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        material: admin ? true : { where: { isActive: true } },
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
        productTags: admin ? { include: { tag: true } } : false,
        colors: {
          include: {
            color: true,
            images: true,
            sizes: {
              ...(admin ? {} : { where: IN_STOCK_SIZE_WHERE }),
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

    if (admin) {
      const tags = (product as any).productTags?.map((pt: any) => pt.tag) ?? [];
      return { ...product, tags };
    }

    product.colors = filterAvailableColors(product.colors);

    return sanitizeDiscount(product);
  }

  // get all products
  async getAllProducts({
    page = 1,
    limit,
    search,
    isActive,
    orderBy,
    colorIds,
    materialIds,
    subCategoryIds,
    minPrice,
    maxPrice,
    thumb = false,
    includeOutOfStock = false,
  }: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
    colorIds?: number[];
    materialIds?: number[];
    subCategoryIds?: number[];
    minPrice?: number;
    maxPrice?: number;
    orderBy?: Record<string, 'asc' | 'desc'>;
    thumb?: boolean;
    includeOutOfStock?: boolean;
  }) {
    // No limit => no pagination, return every product matching the filters.
    const skip = limit ? (page - 1) * limit : undefined;

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

    if (subCategoryIds && subCategoryIds?.length) {
      where.subCategories = {
        some: {
          subCategoryId: { in: subCategoryIds },
        },
      };
    }

    if (minPrice || maxPrice) {
      where.price = {
        ...(minPrice && { gte: minPrice }),
        ...(maxPrice && { lte: maxPrice }),
      };
    }

    // Storefront listings only show in-stock products; admin views pass
    // includeOutOfStock so they can still see/manage products at 0 stock.
    if (!includeOutOfStock) {
      Object.assign(where, IN_STOCK_PRODUCT_WHERE);
    }

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
            discount: true,
            discountType: true,
            discountStart: true,
            discountEnd: true,
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
                  ...(includeOutOfStock ? {} : { where: IN_STOCK_SIZE_WHERE }),
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
      filteredData = (data as any[]).map((product) =>
        sanitizeDiscount({
          ...product,
          colors: includeOutOfStock
            ? (product.colors ?? [])
            : filterAvailableColors(product.colors ?? []),
        }),
      );
    } else {
      filteredData = (data as any[]).map((p) => sanitizeDiscount(p));
    }

    if (search) {
      this.logSearchKeyword(search, total);
    }

    return {
      data: filteredData,
      meta: {
        total,
        page,
        limit: limit ?? total,
        totalPages: limit ? Math.ceil(total / limit) : 1,
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
  async updateProduct(
    slug: string,
    dto: UpdateProductDto,
    adminId: number,
    actorRole?: UserRole,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const resolvedDiscountStart =
      dto.discountStart !== undefined
        ? dto.discountStart
        : product.discountStart;
    const resolvedDiscountEnd =
      dto.discountEnd !== undefined ? dto.discountEnd : product.discountEnd;
    assertValidDiscountWindow(resolvedDiscountStart, resolvedDiscountEnd);

    // Fall back to existing product values so a partial update (e.g. only
    // basePrice sent) doesn't silently drop the stored discount, and vice-versa.
    const effectiveBasePrice = dto.basePrice ?? product.basePrice;
    const effectiveDiscount =
      dto.discount !== undefined ? dto.discount : product.discount;
    const effectiveDiscountType =
      dto.discountType !== undefined ? dto.discountType : product.discountType;

    let price: number = effectiveBasePrice;

    if (effectiveDiscount && effectiveDiscount > 0) {
      if (effectiveDiscountType === DiscountType.PERCENT) {
        price = Math.round(
          effectiveBasePrice - (effectiveBasePrice * effectiveDiscount) / 100,
        );
      } else if (effectiveDiscountType === DiscountType.FIXED) {
        price = effectiveBasePrice - effectiveDiscount;
      }
    }

    if (price < 0) price = 0;

    const piecesGenerated: { productSizeId: number; quantity: number }[] = [];

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
          weight: dto.weight ?? product.weight,
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
          materialId:
            dto.materialId !== undefined ? dto.materialId : product.materialId,
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

      // Update Colors & Sizes
      if (dto.colors) {
        const existingColors = await tx.productColor.findMany({
          where: { productId: product.id },
          include: {
            sizes: {
              select: {
                id: true,
                sizeId: true,
                sku: true,
                basePrice: true,
                discount: true,
                discountType: true,
                quantity: true,
                trackingMode: true,
              },
            },
          },
        });

        // Structural fingerprint: compare colorId+sizeId sets only (ignore quantity/price).
        // Both sides apply the same SKU filter so the comparison is symmetric —
        // empty-SKU placeholder sizes are excluded from structure detection on both ends.
        const existingStructureKey = existingColors
          .map(
            (c) =>
              `${c.colorId}:${c.sizes
                .filter((s) => (s.sku ?? '') !== '')
                .map((s) => String(s.sizeId))
                .sort()
                .join(',')}`,
          )
          .sort()
          .join('|');

        const incomingStructureKey = dto.colors
          .map((c) => {
            const sizeIds = (c.sizes ?? [])
              .filter((s) => (s.sku ?? '') !== '')
              .map((s) => String(s.sizeId))
              .sort()
              .join(',');
            return `${c.colorId}:${sizeIds}`;
          })
          .sort()
          .join('|');

        const structureChanged = existingStructureKey !== incomingStructureKey;

        if (structureChanged) {
          // Guard: refuse if any active cart references these sizes
          const cartConflict = await tx.cartItem.findFirst({
            where: { productSize: { color: { productId: product.id } } },
          });

          if (cartConflict) {
            throw new BadRequestException(
              'Cannot update variants: one or more sizes are currently in a customer cart. Clear the carts first or wait for them to expire.',
            );
          }

          // Guard: refuse a structural rebuild if any size already has
          // piece-level barcodes — deleting it would hit the Piece→
          // ProductSize foreign key (ON DELETE RESTRICT) and, more
          // importantly, would orphan real physical barcodes that already
          // exist. Once a product has piece-tracked sizes, its color/size
          // structure is frozen; price/discount/legacy-quantity edits still
          // work via the "structure unchanged" branch below.
          const pieceConflict = await tx.piece.findFirst({
            where: { productSize: { color: { productId: product.id } } },
          });

          if (pieceConflict) {
            throw new BadRequestException(
              'Cannot restructure variants: one or more sizes are already tracked by piece-level barcodes. ' +
                'Make only price/quantity edits without changing colors or sizes, or manage stock via Generate & Print / Receiving.',
            );
          }

          // Full rebuild — clear old data then recreate
          await tx.productColorImage.deleteMany({
            where: { productColor: { productId: product.id } },
          });

          await tx.productSize.deleteMany({
            where: { color: { productId: product.id } },
          });

          await tx.productColor.deleteMany({
            where: { productId: product.id },
          });

          for (const colorVariant of dto.colors) {
            const productColor = await tx.productColor.create({
              data: {
                productId: product.id,
                colorId: colorVariant.colorId,
                useDefaultImages: colorVariant.useDefaultImages ?? false,
              },
            });

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

            if (colorVariant.sizes && colorVariant.sizes.length > 0) {
              const validSizes = colorVariant.sizes.filter(
                (size) => size.sku != '',
              );

              if (validSizes.length > 0) {
                // A size with no price override inherits the product's
                // basePrice rather than defaulting to null/free.
                const effectiveProductBasePrice =
                  dto.basePrice ?? product.basePrice;

                for (const size of validSizes) {
                  const { productSizeId, quantity } =
                    await this.createSizeWithPieces(
                      tx,
                      productColor.id,
                      size,
                      effectiveProductBasePrice,
                      adminId,
                      actorRole,
                    );
                  if (quantity > 0) {
                    piecesGenerated.push({ productSizeId, quantity });
                  }
                }
              }
            }
          }
        } else {
          // Structure unchanged — update in place, preserving ProductSize IDs so cart items stay valid
          for (const colorVariant of dto.colors) {
            const existingColor = existingColors.find(
              (c) => c.colorId === colorVariant.colorId,
            );
            if (!existingColor) continue;

            await tx.productColor.update({
              where: { id: existingColor.id },
              data: {
                useDefaultImages: colorVariant.useDefaultImages ?? false,
              },
            });

            if (
              !colorVariant.useDefaultImages &&
              colorVariant.images &&
              colorVariant.images.length > 0
            ) {
              await tx.productColorImage.deleteMany({
                where: { productColorId: existingColor.id },
              });
              await tx.productColorImage.createMany({
                data: colorVariant.images.map((imageUrl, index) => ({
                  productColorId: existingColor.id,
                  image: imageUrl,
                  serialNo: index + 1,
                })),
              });
            }

            for (const size of colorVariant.sizes ?? []) {
              const existingSize = existingColor.sizes.find(
                (s) => s.sizeId === size.sizeId,
              );
              if (!existingSize) continue;

              // Piece-tracked sizes only change quantity via a physical
              // receive/return scan (PieceService) or Generate & Print —
              // never through a direct number edit on this form. Reject the
              // write instead of silently desyncing `quantity` from the
              // actual piece count.
              const requestedQuantity = Number(size.quantity);
              if (
                existingSize.trackingMode === 'PIECE_BARCODE' &&
                requestedQuantity !== existingSize.quantity
              ) {
                throw new BadRequestException(
                  `This size is tracked by piece-level barcodes — adjust stock by receiving/returning individual pieces or via Generate & Print, not this form.`,
                );
              }
              const resolvedQuantity =
                existingSize.trackingMode === 'PIECE_BARCODE'
                  ? existingSize.quantity
                  : requestedQuantity;

              // A size update may legitimately omit price/discount (e.g. a
              // quantity-only restock) — fall back to the existing value
              // instead of wiping it, otherwise every partial update would
              // silently null out the price and zero out the discount.
              const resolvedBasePrice =
                size.price !== undefined && size.price !== null
                  ? Number(size.price)
                  : existingSize.basePrice;
              const resolvedDiscount =
                size.discount !== undefined
                  ? size.discount
                  : existingSize.discount;
              const resolvedDiscountType: DiscountType | null =
                size.discountType !== undefined
                  ? size.discountType
                  : (existingSize.discountType as DiscountType | null);

              let sizePrice: number | null = resolvedBasePrice;

              if (
                resolvedBasePrice !== null &&
                resolvedDiscount &&
                resolvedDiscount > 0 &&
                resolvedDiscountType
              ) {
                if (resolvedDiscountType === DiscountType.PERCENT) {
                  sizePrice = Math.round(
                    resolvedBasePrice -
                      (resolvedBasePrice * resolvedDiscount) / 100,
                  );
                } else if (resolvedDiscountType === DiscountType.FIXED) {
                  sizePrice = resolvedBasePrice - resolvedDiscount;
                }
                if (sizePrice !== null && sizePrice < 0) sizePrice = 0;
              }

              await tx.productSize.update({
                where: { id: existingSize.id },
                data: {
                  quantity: resolvedQuantity,
                  sku: size.sku || null,
                  basePrice: resolvedBasePrice,
                  price: sizePrice,
                  discountType: resolvedDiscountType ?? null,
                  discount: resolvedDiscount ?? 0,
                },
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

      const newTotalQuantity =
        updatedProduct?.colors
          ?.flatMap((c) => c.sizes)
          ?.reduce((sum, s) => sum + s.quantity, 0) ?? 0;

      await tx.product.update({
        where: { id: product.id },
        data: { totalProductQuantity: newTotalQuantity },
      });

      if (updatedProduct) {
        updatedProduct.totalProductQuantity = newTotalQuantity;
      }

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
          piecesGenerated,
        },
      });

      return { ...updatedProduct, pieceGeneration: { generated: piecesGenerated } };
    });
  }

  // Re-derive each product's top-level display price from its own
  // basePrice/discount/window. ProductSize.price is deliberately left
  // untouched here — variant pricing is managed independently via each
  // size's own discount fields (see the two-tier design in discount.utils.ts).
  async syncAllProductPrices() {
    const products = await this.prisma.product.findMany();
    const now = new Date();

    for (const product of products) {
      const basePrice = product.basePrice;
      let price = basePrice;

      const hasWindow = !!product.discountStart && !!product.discountEnd;
      const windowActive =
        !hasWindow ||
        (product.discountStart! <= now && product.discountEnd! >= now);

      if (product.discount && product.discount > 0 && windowActive) {
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

    if (visitorId) {
      await this.prisma.visitor.upsert({
        where: { id: visitorId },
        update: {},
        create: { id: visitorId },
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
    if (!productSlug) {
      return [];
    }

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
        ...IN_STOCK_PRODUCT_WHERE,
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
          ...IN_STOCK_PRODUCT_WHERE,
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
          ...IN_STOCK_PRODUCT_WHERE,
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
          ...IN_STOCK_PRODUCT_WHERE,
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
    // console.log(
    //  subCategoryIds,
    // subCategoryIds,
    //productIds,
    // 'subCategoryIds and other ids in getSubCategoryBasedRecommendations',
    //);

    // const ids: number[] = subCategoryIds || [];

    if (subCategorySlug) {
      const sub = await this.prisma.subCategory.findUnique({
        where: { slug: subCategorySlug },
        select: { id: true },
      });

      if (sub) subCategoryIds?.push(sub.id);
    }

    const excludeIds = productIds?.length ? productIds : [];

    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        ...IN_STOCK_PRODUCT_WHERE,
        id: { notIn: excludeIds },

        subCategories: {
          some: {
            subCategoryId: { in: subCategoryIds },
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
          ...IN_STOCK_PRODUCT_WHERE,
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
          ...IN_STOCK_PRODUCT_WHERE,
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
          ...IN_STOCK_PRODUCT_WHERE,
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

    return recommendations.map((p) => sanitizeDiscount(p));
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
          ...IN_STOCK_PRODUCT_WHERE,
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
            discount: true,
            discountType: true,
            discountStart: true,
            discountEnd: true,
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
    const products = views
      .map((v) => v.product)
      .filter((p) => p !== null)
      .map((p) => sanitizeDiscount(p));

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
      discount: true,
      discountType: true,
      discountStart: true,
      discountEnd: true,
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
  }

  // trending products
  async getTrendingProducts(limit: number = 10) {
    const products = await this.prisma.product.findMany({
      where: { isActive: true, ...IN_STOCK_PRODUCT_WHERE },
      orderBy: [{ trendScore: 'desc' }, { soldCount: 'desc' }],
      take: limit,
      select: {
        ...this.recommendationSelect,
        trendScore: true,
        soldCount: true,
      },
    });
    return products.map((p) => sanitizeDiscount(p));
  }

  async getFeaturedProducts(limit: number = 10) {
    const products = await this.prisma.product.findMany({
      where: { isActive: true, isFeatured: true, ...IN_STOCK_PRODUCT_WHERE },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      take: limit,
      include: {
        images: true,
        colors: { include: { color: true } },
      },
    });
    return products.map((p) => sanitizeDiscount(p));
  }

  async getOnSaleProducts({
    page = 1,
    limit = 18,
    sortBy = 'createdAt',
    order = 'desc',
  }: {
    page?: number;
    limit?: number;
    sortBy?: string;
    order?: 'asc' | 'desc';
  }) {
    const now = new Date();
    const where = {
      isActive: true,
      discount: { gt: 0 },
      ...IN_STOCK_PRODUCT_WHERE,
      OR: [
        // No window set → discount never expires.
        { discountStart: null, discountEnd: null },
        { discountStart: { lte: now }, discountEnd: { gte: now } },
      ],
    };

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: +limit,
        orderBy: { [sortBy]: order },
        include: {
          images: true,
          colors: {
            include: { color: true },
          },
          subCategories: {
            include: {
              subCategory: {
                include: {
                  blogs: {
                    where: { blogPost: { published: true } },
                    take: 1,
                    include: {
                      blogPost: {
                        select: {
                          id: true,
                          title: true,
                          slug: true,
                          content: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    const subCategoryMap = new Map<number, any>();
    let blog: any = null;

    for (const product of data) {
      for (const ps of product.subCategories) {
        const sc = ps.subCategory;
        if (!subCategoryMap.has(sc.id)) {
          subCategoryMap.set(sc.id, {
            id: sc.id,
            name: sc.name,
            slug: sc.slug,
            categoryId: sc.categoryId,
          });
        }
        if (!blog) {
          const blogPost = sc.blogs?.[0]?.blogPost;
          if (blogPost) blog = blogPost;
        }
      }
    }

    return {
      products: data.map((p) => sanitizeDiscount(p)),
      subcategories: Array.from(subCategoryMap.values()),
      blog,
      series: 'Sale',
      meta: {
        total,
        page: +page,
        limit: +limit,
        totalPages: Math.ceil(total / +limit),
      },
    };
  }

  async getSaleStatus() {
    const now = new Date();
    const count = await this.prisma.product.count({
      where: {
        isActive: true,
        discount: { gt: 0 },
        totalProductQuantity: { gt: 0 },
        OR: [
          { discountStart: null, discountEnd: null },
          { discountStart: { lte: now }, discountEnd: { gte: now } },
        ],
      },
    });
    return { hasActiveSale: count > 0, count };
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
    isHidden?: boolean | null;
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

    // console.log(isHidden, 'isHidden');

    // Build Prisma filters
    const filters: any = {
      ...(isHidden === false || isHidden === true ? { isHidden } : {}),
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

  async generateProductSchema(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        images: { orderBy: { serialNo: 'asc' } },
        subCategories: {
          include: {
            subCategory: {
              include: {
                category: { include: { series: true } },
              },
            },
          },
        },
      },
    });

    if (!product) throw new NotFoundException(`Product "${slug}" not found`);

    const reviewStats = await this.prisma.review.aggregate({
      where: {
        isHidden: false,
        orderItem: { productId: product.id },
      },
      _avg: { rating: true },
      _count: { rating: true },
    });

    const siteUrl = (process.env.SITE_URL ?? '').replace(/\/$/, '');
    const productUrl = `${siteUrl}/products/${product.slug}`;
    const inStock = product.totalProductQuantity > 0;
    const effectivePrice = product.price ?? product.basePrice;

    const firstSub = product.subCategories[0]?.subCategory;
    const category = firstSub?.category;
    const series = category?.series;

    // BreadcrumbList: Series > Category > SubCategory > Product
    const breadcrumbItems: { name: string; url: string }[] = [];
    if (siteUrl) {
      if (series)
        breadcrumbItems.push({
          name: series.name,
          url: `${siteUrl}/series/${series.slug}`,
        });
      if (category)
        breadcrumbItems.push({
          name: category.name ?? '',
          url: `${siteUrl}/category/${category.slug}`,
        });
      if (firstSub)
        breadcrumbItems.push({
          name: firstSub.name,
          url: `${siteUrl}/subcategory/${firstSub.slug}`,
        });
      breadcrumbItems.push({ name: product.title, url: productUrl });
    }

    const schema: any[] = [
      {
        '@context': 'https://schema.org/',
        '@type': 'Product',
        name: product.title,
        ...(product.description && { description: product.description }),
        ...(product.sku && { sku: product.sku }),
        image: product.images.map((i) => i.image),
        brand: {
          '@type': 'Brand',
          name: product.brand ?? process.env.BRAND_NAME ?? 'Sakigai Furniture',
        },
        ...(firstSub && { category: firstSub.name }),
        offers: {
          '@type': 'Offer',
          ...(siteUrl && { url: productUrl }),
          priceCurrency: 'BDT',
          price: effectivePrice,
          availability: inStock
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
          itemCondition: 'https://schema.org/NewCondition',
        },
        ...(reviewStats._count.rating > 0 && {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: Number((reviewStats._avg.rating ?? 0).toFixed(1)),
            reviewCount: reviewStats._count.rating,
            bestRating: 5,
            worstRating: 1,
          },
        }),
      },
    ];

    if (breadcrumbItems.length > 1) {
      schema.push({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          item: item.url,
        })),
      });
    }

    return schema;
  }
}
