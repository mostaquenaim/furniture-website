/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
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

@Injectable()
export class CategoryService {
  constructor(private prisma: PrismaService) {}

  // ✅ CREATE CATEGORY
  async create(data: {
    slug: string;
    image?: string;
    sortOrder?: number;
    seriesId: number;
  }) {
    try {
      return await this.prisma.category.create({
        data,
      });
    } catch (error) {
      throw new ConflictException(
        'Category with this slug already exists in the series',
      );
    }
  }

  // ✅ GET ALL CATEGORIES (for admin)
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

  // ✅ GET ACTIVE CATEGORIES BY SERIES (frontend menu)
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

  // ✅ UPDATE CATEGORY
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

  // ✅ DELETE CATEGORY (cascade handles subCategories)
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
    console.log('check if active', isActive);

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

  async createSeries(dto: CreateSeriesDto) {
    // Check slug uniqueness (important for admin UX)
    const existing = await this.prisma.series.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new ConflictException('Series with this slug already exists');
    }

    return this.prisma.series.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        image: dto.image ?? null,
        notice: dto.notice ?? null,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  // get products by series
  async getSeriesWiseProducts({
    page = 1,
    limit = 10,
    search,
    isActive = true,
    slug,

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

      ...(search && {
        name: { contains: search, mode: 'insensitive' },
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
            include: { color: true },
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

    const productMap = new Map<number, any>();

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
      products,
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

    console.log(subcategories, 'subcatszz');

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

    return this.prisma.series.update({
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
  }

  // update series order
  async reorder(userId: number, orders: { id: number; sortOrder: number }[]) {
    try {
      // We wrap all updates in a transaction
      return await this.prisma.$transaction(
        orders.map((item) =>
          this.prisma.series.update({
            where: { id: item.id },
            data: { sortOrder: item.sortOrder },
          }),
        ),
      );
    } catch (error) {
      throw new InternalServerErrorException('Could not update series order');
    }
  }

  // =====================
  // CATEGORY
  // =====================
  getAllActiveCategories(withRelations = false) {
    return this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: withRelations
        ? {
            series: true,
            // subCategories: {
            //   where: { isActive: true },
            //   orderBy: { sortOrder: 'asc' },
            // },
          }
        : undefined,
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

  getCategoryById(id: number) {
    return this.prisma.category.findUnique({
      where: { id },
    });
  }

  getCategoryParent(id: number) {
    return this.prisma.category.findUnique({
      where: { id },
      include: { series: true },
    });
  }

  async createCategory(dto: CreateCategoryDto) {
    // Ensure parent series exists
    const series = await this.prisma.series.findUnique({
      where: { id: dto.seriesId },
    });

    if (!series) {
      throw new NotFoundException('Series not found');
    }

    // Enforce slug uniqueness per series
    const existing = await this.prisma.category.findFirst({
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
    return this.prisma.category.create({
      data: {
        name: dto.name ?? null,
        slug: dto.slug,
        image: dto.image ?? null,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
        seriesId: dto.seriesId,
      },
    });
  }

  // =====================
  // SUBCATEGORY
  // =====================
  getAllActiveSubCategories(withRelations = false) {
    return this.prisma.subCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: withRelations
        ? {
            category: true,
            // {
            //   include: {
            //     series: true,
            //   },
            // },
          }
        : undefined,
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

      ...(search && {
        name: { contains: search, mode: 'insensitive' },
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
            include: { color: true },
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

    const productMap = new Map<number, any>();
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
      products: rows,
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

  getSubCategoryById(id: number) {
    return this.prisma.subCategory.findUnique({
      where: { id },
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

  async createSubCategory(dto: CreateSubCategoryDto) {
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
    return this.prisma.subCategory.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        image: dto.image ?? null,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
        categoryId: dto.categoryId,
      },
    });
  }
}
