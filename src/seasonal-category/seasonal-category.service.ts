/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSeasonalCategoryDto } from './dto/create-seasonal-category.dto';
import { UpdateSeasonalCategoryDto } from './dto/update-seasonal-category.dto';

@Injectable()
export class SeasonalCategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSeasonalCategoryDto) {
    const { startDate, endDate, sortOrder, ...rest } = dto;

    if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
      throw new BadRequestException('startDate must be before endDate');
    }

    // Default sortOrder to max + 1 if not provided
    let resolvedSortOrder = sortOrder ?? 0;
    if (sortOrder === undefined) {
      const max = await this.prisma.seasonalCategory.aggregate({
        _max: { sortOrder: true },
      });
      resolvedSortOrder = (max._max.sortOrder ?? -1) + 1;
    }

    return this.prisma.seasonalCategory.create({
      data: {
        ...rest,
        sortOrder: resolvedSortOrder,
        isActive: rest.isActive ?? true,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
    });
  }

  findAll(onlyActive?: boolean) {
    const where: any = {};

    if (onlyActive) {
      const now = new Date();
      where.isActive = true;
      where.OR = [
        { startDate: null, endDate: null },
        { startDate: { lte: now }, endDate: null },
        { startDate: null, endDate: { gte: now } },
        { startDate: { lte: now }, endDate: { gte: now } },
      ];
    }

    return this.prisma.seasonalCategory.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findOne(id: number) {
    const category = await this.prisma.seasonalCategory.findUnique({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException(`Seasonal category #${id} not found`);
    }
    return category;
  }

  async update(id: number, dto: UpdateSeasonalCategoryDto) {
    await this.findOne(id); // throws 404 if missing

    const { startDate, endDate, ...rest } = dto;

    // Determine effective dates for validation
    const existing = await this.prisma.seasonalCategory.findUnique({
      where: { id },
      select: { startDate: true, endDate: true },
    });

    const effectiveStart = startDate
      ? new Date(startDate)
      : existing?.startDate;
    const effectiveEnd = endDate ? new Date(endDate) : existing?.endDate;

    if (effectiveStart && effectiveEnd && effectiveStart >= effectiveEnd) {
      throw new BadRequestException('startDate must be before endDate');
    }

    return this.prisma.seasonalCategory.update({
      where: { id },
      data: {
        ...rest,
        ...(startDate !== undefined && {
          startDate: startDate ? new Date(startDate) : null,
        }),
        ...(endDate !== undefined && {
          endDate: endDate ? new Date(endDate) : null,
        }),
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.seasonalCategory.delete({ where: { id } });
  }

  async reorder(orderedIds: number[]) {
    const updates = orderedIds.map((id, index) =>
      this.prisma.seasonalCategory.update({
        where: { id },
        data: { sortOrder: index },
      }),
    );
    return this.prisma.$transaction(updates);
  }
}
