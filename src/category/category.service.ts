import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSeriesDto } from './dto/seriesDto.dto';

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

  getAllSeries(withRelations = false, isActive?: boolean) {
    return this.prisma.series.findMany({
      where: {
        ...(isActive !== undefined && { isActive }),
      },
      orderBy: { sortOrder: 'asc' },
      include: withRelations
        ? {
            categories: {
              where: {
                ...(isActive !== undefined && { isActive }),
              },
              orderBy: { sortOrder: 'asc' },
              include: {
                subCategories: {
                  where: {
                    ...(isActive !== undefined && { isActive }),
                  },
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          }
        : undefined,
    });
  }

  getSeriesById(id: number) {
    return this.prisma.series.findUnique({
      where: { id },
    });
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
            subCategories: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
            },
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

  // =====================
  // SUBCATEGORY
  // =====================

  getAllActiveSubCategories(withRelations = false) {
    return this.prisma.subCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: withRelations
        ? {
            category: {
              include: {
                series: true,
              },
            },
          }
        : undefined,
    });
  }

  getSubCategoriesByCategory(categoryId: number) {
    return this.prisma.subCategory.findMany({
      where: {
        categoryId,
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
    });
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
}
