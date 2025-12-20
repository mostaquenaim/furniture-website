import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
}
