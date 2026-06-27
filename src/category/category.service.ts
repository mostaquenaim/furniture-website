/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSeriesDto } from './dto/seriesDto.dto';
import { CreateCategoryDto } from './dto/categoryDto.dto';
import { CreateSubCategoryDto } from './dto/subCategoryDto.dto';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { LogModule } from '@prisma/client';
import { sanitizeDiscount } from 'src/common/utils/discount.utils';

@Injectable()
export class CategoryService {
  constructor(
    private prisma: PrismaService,
    private activityLogService: ActivityLogService,
  ) {}

  // CREATE CATEGORY
  async create(data: {
    slug: string;
    image?: string;
    sortOrder?: number;
    seriesId: number;
  }) {
    try {
      const cat = await this.prisma.category.create({
        data,
      });

      // this.activityLogService.log({
      //   adminId,
      //   action: 'CREATE_BLOG',
      //   module: 'CONTENT',
      //   targetId: blog.id,
      //   targetLabel: blog.title,
      //   newValue: {
      //     title: blog.title,
      //     slug: blog.slug,
      //     content: blog.content,
      //     categoryId: blog.categoryId,
      //     published: blog.published,
      //   },
      // });

      return cat;
    } catch (error) {
      throw new ConflictException(
        'Category with this slug already exists in the series',
      );
    }
  }

  // GET ALL CATEGORIES (for admin)
  async findAll() {
    return this.prisma.category.findMany({
      include: {
        series: true,
        subCategories: true,
      },
      orderBy: {
        sortOrder: 'asc',
      },
    });
  }

  // GET ACTIVE CATEGORIES BY SERIES (frontend menu)
  async findBySeries(seriesId: number) {
    return this.prisma.category.findMany({
      where: {
        seriesId,
        isActive: true,
      },
      include: {
        subCategories: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: {
        sortOrder: 'asc',
      },
    });
  }

  // UPDATE CATEGORY
  async update(
    id: number,
    data: {
      slug?: string;
      image?: string;
      sortOrder?: number;
      isActive?: boolean;
    },
  ) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');

    return this.prisma.category.update({
      where: { id },
      data,
    });
  }

  // DELETE CATEGORY (cascade handles subCategories)
  async remove(id: number) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');

    return this.prisma.category.delete({
      where: { id },
    });
  }

  // =====================
  // SERIES
  // =====================
  getAllSeries(withRelations = false, isActive?: boolean | null) {
  // console.log('check if active', isActive);

    return this.prisma.series.findMany({
      where: {
        ...(isActive !== undefined && isActive !== null && { isActive }),
      },
      orderBy: { sortOrder: 'asc' },

      select: {
        id: true,
        name: true,
        slug: true,
        image: true,
        notice: true,
        sortOrder: true,
        isActive: true,

        ...(withRelations && {
          categories: {
            where: {
              ...(isActive !== undefined && isActive !== null && { isActive }),
            },
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              name: true,
              slug: true,

              subCategories: {
                where: {
                  ...(isActive !== undefined &&
                    isActive !== null && { isActive }),
                },
                orderBy: { sortOrder: 'asc' },
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        }),
      },
    });
  }

  getSeriesBySlug(slug: string) {
    return this.prisma.series.findUnique({
      where: { slug },
    });
  }

  async createSeries(dto: CreateSeriesDto, adminId: number) {
    // Check slug uniqueness (important for admin UX)
    const existing = await this.prisma.series.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new ConflictException('Series with this slug already exists');
    }

    const series = await this.prisma.series.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        image: dto.image ?? null,
        notice: dto.notice ?? null,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });

    // Log activity
    this.activityLogService.log({
      adminId,
      action: 'CREATE_SERIES',
      module: 'CATALOG',
      targetId: series.id,
      targetLabel: series.name,
      metadata: {
        dto,
      },
    });

    return series;
  }

  // get products by series
  async getSeriesWiseProducts({
    page = 1,
    limit = 10,
    search,
    isActive = true,
    slug,
    admin = false,

    colorIds,
    materialIds,
    subCategoryIds,
    minPrice,
    maxPrice,
    orderBy,
  }: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
    slug?: string;
    admin?: boolean;

    colorIds?: number[];
    materialIds?: number[];
    subCategoryIds?: number[];
    minPrice?: number;
    maxPrice?: number;
    orderBy?: Record<string, 'asc' | 'desc'> | undefined;
  }) {
    // find series
    // console.log(orderBy);
    const selectedSeries = await this.prisma.series.findFirst({
      where: { slug },
      select: { id: true, name: true },
    });

    if (!selectedSeries) {
      return {
        products: [],
        subcategories: [],
        blog: null,
        meta: { total: 0, page, limit, totalPages: 0 },
      };
    }

    const skip = (page - 1) * limit;

    const productWhere: any = {
      isActive,

      totalProductQuantity: {
        gt: 0,
      },

      ...(search && {
        title: { contains: search, mode: 'insensitive' },
      }),

      ...(minPrice || maxPrice
        ? {
            price: {
              ...(minPrice && { gte: minPrice }),
              ...(maxPrice && { lte: maxPrice }),
            },
          }
        : {}),

      ...(materialIds?.length && {
        materialId: {
          in: materialIds,
        },
      }),

      ...(colorIds?.length && {
        colors: {
          some: {
            colorId: { in: colorIds },
          },
        },
      }),
    };

    const subCategoryWhere: any = {
      isActive,

      ...(subCategoryIds?.length && {
        id: {
          in: subCategoryIds,
        },
      }),
    };

    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        skip,
        take: limit,
        where: {
          ...productWhere,
          subCategories: {
            some: {
              subCategory: {
                ...subCategoryWhere,
                category: {
                  isActive,
                  seriesId: selectedSeries.id,
                  series: { isActive },
                },
              },
            },
          },
        },
        orderBy: orderBy ?? { sortOrder: 'asc' },
        include: {
          images: true,
          colors: {
            include: {
              color: true,
              ...(!admin && { sizes: { where: { quantity: { gt: 0 } } } }),
            },
          },
          subCategories: {
            include: {
              subCategory: {
                include: {
                  blogs: {
                    where: {
                      blogPost: { published: true },
                    },
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

      this.prisma.product.count({
        where: {
          ...productWhere,
          subCategories: {
            some: {
              subCategory: {
                ...subCategoryWhere,
                category: {
                  isActive,
                  seriesId: selectedSeries.id,
                  series: { isActive },
                },
              },
            },
          },
        },
      }),
    ]);

    // console.log(total,'totaaal');
    // ---------------------------
    // NORMALIZATION
    // ---------------------------

    const subCategoryMap = new Map<number, any>();
    let blog: any = null;

    for (const product of products) {
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
      products: products.map((p) =>
        sanitizeDiscount(
          admin
            ? p
            : {
                ...p,
                colors: ((p as any).colors as any[]).filter(
                  (c: any) => c.sizes.length > 0,
                ),
              },
        ),
      ),
      subcategories: Array.from(subCategoryMap.values()),
      blog,
      series: selectedSeries.name,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // get series wise subcategories
  async getSeriesWiseSubcategories(slug: string) {
    // Find the series by slug and include its categories and subcategories
    const seriesWithSubcategories = await this.prisma.series.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        categories: {
          where: { isActive: true }, // optional: only active categories
          select: {
            id: true,
            name: true,
            slug: true,
            subCategories: {
              where: { isActive: true }, // optional: only active subcategories
              select: {
                id: true,
                name: true,
                slug: true,
                image: true,
              },
              orderBy: { sortOrder: 'asc' },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    // Flatten all subcategories into a single array if needed
    const subcategories =
      seriesWithSubcategories?.categories.flatMap((cat) => cat.subCategories) ||
      [];

    return subcategories;
  }

  //update series
  async updateSeriesBySlug(
    userId: number,
    slug: string,
    seriesDto: CreateSeriesDto,
  ) {
    const existingSeries = await this.prisma.series.findUnique({
      where: { slug },
    });

    if (!existingSeries) {
      throw new NotFoundException('Series not found');
    }

    // check for duplicate name
    const duplicateName = await this.prisma.series.findFirst({
      where: {
        name: seriesDto.name,
        NOT: {
          id: existingSeries.id,
        },
      },
    });

    if (duplicateName) {
      throw new ConflictException('Series name already exists');
    }

    // Check duplicate SLUG (excluding current series)
    const duplicateSlug = await this.prisma.series.findFirst({
      where: {
        slug: seriesDto.slug,
        NOT: {
          id: existingSeries.id,
        },
      },
    });

    if (duplicateSlug) {
      throw new ConflictException('Series slug already exists');
    }

    const series = await this.prisma.series.update({
      where: { slug },
      data: {
        name: seriesDto.name,
        slug: seriesDto.slug,
        image: seriesDto.image,
        notice: seriesDto.notice,
        isActive: seriesDto.isActive,
        sortOrder: seriesDto.sortOrder,
      },
    });

    // Activity log
    this.activityLogService.log({
      adminId: userId,
      action: 'UPDATE_SERIES',
      module: 'CATALOG',
      targetId: series.id,
      targetLabel: series.name,
      oldValue: {
        name: existingSeries.name,
        slug: existingSeries.slug,
        image: existingSeries.image,
        notice: existingSeries.notice,
        isActive: existingSeries.isActive,
        sortOrder: existingSeries.sortOrder,
      },
      newValue: {
        name: series.name,
        slug: series.slug,
        image: series.image,
        notice: series.notice,
        isActive: series.isActive,
        sortOrder: series.sortOrder,
      },
    });

    return series;
  }

  // update series order
  async reorderSeries(
    userId: number,
    orders: { id: number; sortOrder: number }[],
  ) {
    try {
      const normalRows = await this.prisma.series.findMany({
        where: {
          id: { in: orders.map((o) => o.id) },
          seriesType: 'NORMAL',
        },
        select: { id: true },
      });
      const normalIds = new Set(normalRows.map((r) => r.id));
      const filteredOrders = orders.filter((o) => normalIds.has(o.id));

      const series = await this.prisma.$transaction(
        filteredOrders.map((item) =>
          this.prisma.series.update({
            where: { id: item.id },
            data: { sortOrder: item.sortOrder },
          }),
        ),
      );

      this.activityLogService.log({
        adminId: userId,
        action: 'REORDER_SERIES',
        module: 'CATALOG',
        metadata: {
          reorderedItems: orders,
        },
        targetLabel: 'Series order',
      });

      return series;
    } catch (error) {
      this.activityLogService.log({
        adminId: userId,
        action: 'REORDER_SERIES',
        module: 'CATALOG',
        severity: 'ERROR',
        status: 'FAILED',
        metadata: {
          attemptedOrders: orders,
          error: error?.message,
        },
        targetLabel: 'Series order',
      });

      throw new InternalServerErrorException('Could not update series order');
    }
  }

  // =====================
  // CATEGORY
  // =====================
  getAllCategories(withRelations: boolean = false, isActive?: boolean | null) {
    return this.prisma.category.findMany({
      where: {
        ...(isActive !== undefined && isActive !== null && { isActive }),
      },
      orderBy: { sortOrder: 'asc' },

      select: {
        id: true,
        name: true,
        slug: true,
        image: true,
        sortOrder: true,
        isActive: true,
        seriesId: true,

        // Always send minimal series info
        series: {
          select: {
            id: true,
            name: true,
          },
        },

        // Only when full relation needed
        ...(withRelations && {
          series: true,
          // subCategories: {
          //   where: { isActive: true },
          //   orderBy: { sortOrder: 'asc' },
          // },
        }),
      },
    });
  }

  getCategoriesBySeries(seriesId: number) {
    return this.prisma.category.findMany({
      where: {
        seriesId,
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  // get category with series by slug
  getCategoryBySlug(slug: string) {
    return this.prisma.category.findUnique({
      where: { slug },
      include: {
        series: true,
      },
    });
  }

  getCategoryParent(id: number) {
    return this.prisma.category.findUnique({
      where: { id },
      include: { series: true },
    });
  }

  // create category
  async createCategory(dto: CreateCategoryDto, adminId: number) {
    // Ensure parent series exists
    const series = await this.prisma.series.findUnique({
      where: { id: dto.seriesId },
    });

    if (!series) {
      throw new NotFoundException('Series not found');
    }

    // Enforce slug uniqueness per series
    const existing = await this.prisma.category.findUnique({
      where: {
        seriesId: dto.seriesId,
        slug: dto.slug,
      },
    });

    if (existing) {
      throw new ConflictException(
        'Category with this slug already exists in the selected series',
      );
    }

    // Create category
    const category = await this.prisma.category.create({
      data: {
        name: dto.name ?? null,
        slug: dto.slug,
        image: dto.image ?? null,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
        seriesId: dto.seriesId,
      },
    });

    // Log activity
    this.activityLogService.log({
      adminId,
      action: 'CREATE_CATEGORY',
      module: 'CATALOG',
      targetId: category.id,
      targetLabel: category?.name || '',
      metadata: {
        dto,
      },
    });

    return category;
  }

  // update categories order
  async reorderCategories(
    userId: number,
    orders: { id: number; sortOrder: number }[],
  ) {
    try {
      // We wrap all updates in a transaction
      const categories = await this.prisma.$transaction(
        orders.map((item) =>
          this.prisma.category.update({
            where: { id: item.id },
            data: { sortOrder: item.sortOrder },
          }),
        ),
      );

      this.activityLogService.log({
        adminId: userId,
        action: 'REORDER_CATEGORIES',
        module: 'CATALOG',
        metadata: {
          reorderedItems: orders,
        },
        targetLabel: 'Category order',
      });

      return categories;
    } catch (error) {
      this.activityLogService.log({
        adminId: userId,
        action: 'REORDER_CATEGORIES',
        module: 'CATALOG',
        severity: 'ERROR',
        status: 'FAILED',
        metadata: {
          attemptedOrders: orders,
          error: error?.message,
        },
        targetLabel: 'Category order',
      });

      throw new InternalServerErrorException(
        'Could not update categories order',
      );
    }
  }

  //update category
  async updateCategory(
    userId: number,
    slug: string,
    categoryDto: CreateCategoryDto,
  ) {
    const existingCategory = await this.prisma.category.findUnique({
      where: { slug },
    });

    if (!existingCategory) {
      throw new NotFoundException('Category not found');
    }

    // check for duplicate name
    const duplicateName = await this.prisma.category.findFirst({
      where: {
        name: categoryDto.name,
        NOT: {
          id: existingCategory.id,
        },
      },
    });

    if (duplicateName) {
      throw new ConflictException('Category name already exists');
    }

    // Check duplicate SLUG (excluding current category)
    const duplicateSlug = await this.prisma.category.findUnique({
      where: {
        slug: categoryDto.slug,
        NOT: {
          id: existingCategory.id,
        },
      },
    });

    if (duplicateSlug) {
      throw new ConflictException('Category slug already exists');
    }

    const category = await this.prisma.category.update({
      where: { id: existingCategory.id },
      data: {
        name: categoryDto.name,
        slug: categoryDto.slug,
        image: categoryDto.image,
        isActive: categoryDto.isActive,
        sortOrder: categoryDto.sortOrder,
        seriesId: categoryDto.seriesId,
      },
    });

    this.activityLogService.log({
      adminId: userId,
      action: 'UPDATE_CATEGORIES',
      module: 'CATALOG',
      targetId: category.id,
      targetLabel: category.name ?? '',
      oldValue: {
        name: existingCategory.name,
        slug: existingCategory.slug,
        image: existingCategory.image,
        isActive: existingCategory.isActive,
        sortOrder: existingCategory.sortOrder,
      },
      newValue: {
        name: category.name,
        slug: category.slug,
        image: category.image,
        isActive: category.isActive,
        sortOrder: category.sortOrder,
      },
    });

    return category;
  }

  // =====================
  // SUBCATEGORY
  // =====================
  getAllSubCategories(
    withRelations: boolean = false,
    isActive?: boolean | null,
  ) {
    return this.prisma.subCategory.findMany({
      where: {
        ...(isActive !== undefined && isActive !== null && { isActive }),
      },
      orderBy: { sortOrder: 'asc' },

      select: {
        id: true,
        name: true,
        slug: true,
        image: true,
        sortOrder: true,
        isActive: true,
        categoryId: true,

        // Only when full relation needed
        category: withRelations
          ? true // Returns the full category object
          : {
              select: {
                id: true,
                name: true,
                series: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
      },
    });
  }

  // get subcategories by categories
  getSubCategoriesByCategory(categoryId: number) {
    return this.prisma.subCategory.findMany({
      where: {
        categoryId,
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  // get products by subcategory
  async getSubCategoryWiseProducts({
    page = 1,
    limit = 10,
    search,
    isActive = true,
    slug,
    admin = false,

    colorIds,
    materialIds,
    minPrice,
    maxPrice,
    orderBy,
  }: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
    slug?: string;
    admin?: boolean;

    colorIds?: number[];
    materialIds?: number[];
    minPrice?: number;
    maxPrice?: number;
    orderBy?: Record<string, 'asc' | 'desc'> | undefined;
  }) {
    const subCategory = await this.prisma.subCategory.findFirst({
      where: {
        slug,
        isActive,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            series: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        categoryId: true,
      },
    });

    if (!subCategory) {
      return {
        products: [],
        blog: null,
        subCategory: null,
        meta: { total: 0, page, limit, totalPages: 0 },
      };
    }

    const skip = (page - 1) * limit;

    const productWhere: any = {
      isActive,

      totalProductQuantity: {
        gt: 0,
      },

      ...(search && {
        title: { contains: search, mode: 'insensitive' },
      }),

      ...(minPrice || maxPrice
        ? {
            price: {
              ...(minPrice && { gte: minPrice }),
              ...(maxPrice && { lte: maxPrice }),
            },
          }
        : {}),

      ...(materialIds?.length && {
        materialId: {
          in: materialIds,
        },
      }),

      ...(colorIds?.length && {
        colors: {
          some: {
            colorId: { in: colorIds },
          },
        },
      }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        skip,
        take: limit,
        where: {
          ...productWhere,
          subCategories: {
            some: {
              subCategory: {
                isActive: true,
                id: subCategory.id,
              },
            },
          },
        },
        orderBy: orderBy ?? { sortOrder: 'asc' },
        include: {
          images: true,
          colors: {
            include: {
              color: true,
              ...(!admin && { sizes: { where: { quantity: { gt: 0 } } } }),
            },
          },
          subCategories: {
            include: {
              subCategory: {
                include: {
                  blogs: {
                    where: {
                      blogPost: { published: true },
                    },
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

      this.prisma.product.count({
        where: {
          ...productWhere,
          subCategories: {
            some: {
              subCategory: {
                isActive: true,
                id: subCategory.id,
              },
            },
          },
        },
      }),
    ]);

    // ---------------------------
    // NORMALIZATION
    // ---------------------------

    let blog: any = null;
    let found = false;

    for (const row of rows) {
      for (const ps of row.subCategories) {
        const blogPost = ps.subCategory.blogs?.[0]?.blogPost;

        if (blogPost) {
          blog = blogPost;
          found = true;
          break; // break inner loop
        }
      }

      if (found) break; // break outer loop
    }

    return {
      products: rows.map((p) =>
        sanitizeDiscount(
          admin
            ? p
            : {
                ...p,
                colors: ((p as any).colors as any[]).filter(
                  (c: any) => c.sizes.length > 0,
                ),
              },
        ),
      ),
      blog,
      subCategory,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getSeriesFilters(slug: string) {
    const baseProductWhere = {
      isActive: true,
      totalProductQuantity: { gt: 0 },
      subCategories: {
        some: {
          subCategory: {
            isActive: true,
            category: {
              isActive: true,
              series: { slug, isActive: true },
            },
          },
        },
      },
    };

    const [materials, colors] = await this.prisma.$transaction([
      this.prisma.material.findMany({
        where: { isActive: true, products: { some: baseProductWhere } },
        orderBy: { order: 'asc' },
      }),
      this.prisma.color.findMany({
        where: {
          isActive: true,
          productColor: { some: { product: baseProductWhere } },
        },
        orderBy: { sortOrder: 'asc' },
      }),
    ]);

    return { materials, colors };
  }

  async getSubCategoryFilters(slug: string) {
    const baseProductWhere = {
      isActive: true,
      totalProductQuantity: { gt: 0 },
      subCategories: {
        some: {
          subCategory: { slug, isActive: true },
        },
      },
    };

    const [materials, colors] = await this.prisma.$transaction([
      this.prisma.material.findMany({
        where: { isActive: true, products: { some: baseProductWhere } },
        orderBy: { order: 'asc' },
      }),
      this.prisma.color.findMany({
        where: {
          isActive: true,
          productColor: { some: { product: baseProductWhere } },
        },
        orderBy: { sortOrder: 'asc' },
      }),
    ]);

    return { materials, colors };
  }

  getSubCategoryBySlug(slug: string) {
    return this.prisma.subCategory.findUnique({
      where: { slug },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            series: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  getSubCategoryParent(id: number) {
    return this.prisma.subCategory.findUnique({
      where: { id },
      include: {
        category: {
          include: {
            series: true,
          },
        },
      },
    });
  }

  async createSubCategory(dto: CreateSubCategoryDto, adminId: number) {
    // Ensure parent category exists
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Enforce slug uniqueness per series
    const existing = await this.prisma.subCategory.findFirst({
      where: {
        categoryId: dto.categoryId,
        slug: dto.slug,
      },
    });

    if (existing) {
      throw new ConflictException(
        'SubCategory with this slug already exists in the selected category',
      );
    }

    // Create subcategory
    const subCategory = await this.prisma.subCategory.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        image: dto.image ?? null,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
        categoryId: dto.categoryId,
      },
    });

    // Log activity
    this.activityLogService.log({
      adminId,
      action: 'CREATE_SUBCATEGORY',
      module: 'CATALOG',
      targetId: subCategory.id,
      targetLabel: subCategory?.name || '',
      metadata: {
        dto,
      },
    });

    return subCategory;
  }

  //update subcategory
  async updatesSubcategory(
    userId: number,
    slug: string,
    categoryDto: CreateSubCategoryDto,
  ) {
    const existingCategory = await this.prisma.subCategory.findUnique({
      where: { slug },
    });

    if (!existingCategory) {
      throw new NotFoundException('Category not found');
    }

    // check for duplicate name
    const duplicateName = await this.prisma.subCategory.findFirst({
      where: {
        name: categoryDto.name,
        NOT: {
          id: existingCategory.id,
        },
      },
    });

    if (duplicateName) {
      throw new ConflictException('Category name already exists');
    }

    // Check duplicate SLUG (excluding current category)
    const duplicateSlug = await this.prisma.category.findUnique({
      where: {
        slug: categoryDto.slug,
        NOT: {
          id: existingCategory.id,
        },
      },
    });

    if (duplicateSlug) {
      throw new ConflictException('Category slug already exists');
    }

    const subCategory = await this.prisma.subCategory.update({
      where: { id: existingCategory.id },
      data: {
        name: categoryDto.name,
        slug: categoryDto.slug,
        image: categoryDto.image,
        isActive: categoryDto.isActive,
        sortOrder: categoryDto.sortOrder,
        categoryId: categoryDto.categoryId,
        advancePercentage: categoryDto.advancePercentage,
        isAdvancePayment: categoryDto.isAdvancePayment,
        isCODAvailable: categoryDto.isCODAvailable,
      },
    });

    this.activityLogService.log({
      adminId: userId,
      action: 'UPDATE_SUBCATEGORIES',
      module: 'CATALOG',
      targetId: subCategory.id,
      targetLabel: subCategory.name ?? '',
      oldValue: {
        name: existingCategory.name,
        slug: existingCategory.slug,
        image: existingCategory.image,
        isActive: existingCategory.isActive,
        sortOrder: existingCategory.sortOrder,
      },
      newValue: {
        name: subCategory.name,
        slug: subCategory.slug,
        image: subCategory.image,
        isActive: subCategory.isActive,
        sortOrder: subCategory.sortOrder,
      },
    });

    return subCategory;
  }

  // update subcategories order
  async reorderSubcategories(
    userId: number,
    orders: { id: number; sortOrder: number }[],
  ) {
    try {
      // We wrap all updates in a transaction
      const subcategories = await this.prisma.$transaction(
        orders.map((item) =>
          this.prisma.subCategory.update({
            where: { id: item.id },
            data: { sortOrder: item.sortOrder },
          }),
        ),
      );

      this.activityLogService.log({
        adminId: userId,
        action: 'REORDER_SUBCATEGORIES',
        module: 'CATALOG',
        metadata: {
          reorderedItems: orders,
        },
        targetLabel: 'Subcategory order',
      });

      return subcategories;
    } catch (error) {
      this.activityLogService.log({
        adminId: userId,
        action: 'REORDER_SUBCATEGORIES',
        module: 'CATALOG',
        severity: 'ERROR',
        status: 'FAILED',
        metadata: {
          attemptedOrders: orders,
          error: error?.message,
        },
        targetLabel: 'Subcategory order',
      });

      throw new InternalServerErrorException(
        'Could not update categories order',
      );
    }
  }
}
