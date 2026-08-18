/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CreateFeaturedCategoryDto } from './dto/create-featured-category.dto';
import { UpdateFeaturedCategoryDto } from './dto/update-featured-category.dto';

const MAX_FEATURED = 6;

const SUBCATEGORY_SELECT = {
  id: true,
  name: true,
  slug: true,
  image: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
      series: { select: { id: true, name: true, slug: true } },
    },
  },
};

@Injectable()
export class FeaturedCategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  /** Public: up to 6 active tiles, sorted by sortOrder */
  findActive() {
    return this.prisma.featuredCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      take: MAX_FEATURED,
      select: {
        id: true,
        image: true,
        sortOrder: true,
        subcategory: { select: SUBCATEGORY_SELECT },
      },
    });
  }

  /** Admin: all tiles including inactive */
  findAll() {
    return this.prisma.featuredCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        image: true,
        sortOrder: true,
        isActive: true,
        subCategoryId: true,
        createdAt: true,
        subcategory: { select: SUBCATEGORY_SELECT },
      },
    });
  }

  async create(dto: CreateFeaturedCategoryDto, adminId: number) {
    const activeCount = await this.prisma.featuredCategory.count({
      where: { isActive: true },
    });

    if (activeCount >= MAX_FEATURED && (dto.isActive ?? true)) {
      throw new BadRequestException(
        `Maximum ${MAX_FEATURED} featured categories allowed. Deactivate one before adding a new active tile.`,
      );
    }

    const nextOrder = await this.prisma.featuredCategory.count();

    const tile = await this.prisma.featuredCategory.create({
      data: {
        subCategoryId: dto.subCategoryId,
        image: dto.image,
        sortOrder: dto.sortOrder ?? nextOrder,
        isActive: dto.isActive ?? true,
      },
      select: {
        id: true,
        image: true,
        sortOrder: true,
        isActive: true,
        subcategory: { select: SUBCATEGORY_SELECT },
      },
    });

    this.activityLog.log({
      adminId,
      action: 'CREATE_FEATURED_CATEGORY',
      module: 'CATALOG',
      targetId: tile.id,
      targetLabel: tile.subcategory?.name ?? String(tile.id),
      newValue: tile,
    });

    return tile;
  }

  async update(id: number, dto: UpdateFeaturedCategoryDto, adminId: number) {
    const existing = await this.prisma.featuredCategory.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException(`Featured category ${id} not found`);

    if (dto.isActive === true && !existing.isActive) {
      const activeCount = await this.prisma.featuredCategory.count({
        where: { isActive: true },
      });
      if (activeCount >= MAX_FEATURED) {
        throw new BadRequestException(
          `Maximum ${MAX_FEATURED} active featured categories allowed.`,
        );
      }
    }

    const updated = await this.prisma.featuredCategory.update({
      where: { id },
      data: {
        ...(dto.subCategoryId !== undefined && {
          subCategoryId: dto.subCategoryId,
        }),
        ...(dto.image !== undefined && { image: dto.image }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: {
        id: true,
        image: true,
        sortOrder: true,
        isActive: true,
        subcategory: { select: SUBCATEGORY_SELECT },
      },
    });

    this.activityLog.log({
      adminId,
      action: 'UPDATE_FEATURED_CATEGORY',
      module: 'CATALOG',
      targetId: updated.id,
      targetLabel: updated.subcategory?.name ?? String(updated.id),
      oldValue: existing,
      newValue: updated,
    });

    return updated;
  }

  async remove(id: number, adminId: number) {
    const existing = await this.prisma.featuredCategory.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException(`Featured category ${id} not found`);

    await this.prisma.featuredCategory.delete({ where: { id } });

    this.activityLog.log({
      adminId,
      action: 'DELETE_FEATURED_CATEGORY',
      module: 'CATALOG',
      targetId: id,
      targetLabel: String(id),
      oldValue: existing,
    });
  }

  async reorder(
    orders: { id: number; sortOrder: number }[],
    adminId: number,
  ) {
    try {
      const result = await this.prisma.$transaction(
        orders.map((item) =>
          this.prisma.featuredCategory.update({
            where: { id: item.id },
            data: { sortOrder: item.sortOrder },
          }),
        ),
      );

      this.activityLog.log({
        adminId,
        action: 'REORDER_FEATURED_CATEGORIES',
        module: 'CATALOG',
        metadata: { orders },
        targetLabel: 'Featured category order',
      });

      return result;
    } catch {
      throw new InternalServerErrorException(
        'Could not reorder featured categories',
      );
    }
  }
}
