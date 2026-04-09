/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHomepageGalleryDto } from './dto/create-homepage-gallery.dto';
import { UpdateHomepageGalleryDto } from './dto/update-homepage-gallery.dto';

@Injectable()
export class HomepageGalleryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateHomepageGalleryDto) {
    // Ensure slug is unique
    const existing = await this.prisma.homepageGallery.findFirst({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException(`Slug "${dto.slug}" is already in use`);
    }

    let sortOrder = dto.sortOrder;
    if (sortOrder === undefined) {
      const max = await this.prisma.homepageGallery.aggregate({
        _max: { sortOrder: true },
      });
      sortOrder = (max._max.sortOrder ?? -1) + 1;
    }

    return this.prisma.homepageGallery.create({
      data: {
        ...dto,
        sortOrder,
        isActive: dto.isActive ?? true,
      },
    });
  }

  findAll(onlyActive?: boolean) {
    return this.prisma.homepageGallery.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findOne(id: number) {
    const item = await this.prisma.homepageGallery.findUnique({
      where: { id },
    });
    if (!item) throw new NotFoundException(`Gallery item #${id} not found`);
    return item;
  }

  async update(id: number, dto: UpdateHomepageGalleryDto) {
    await this.findOne(id);

    // If slug is being changed, check uniqueness
    if (dto.slug) {
      const conflict = await this.prisma.homepageGallery.findFirst({
        where: { slug: dto.slug, NOT: { id } },
      });
      if (conflict) {
        throw new ConflictException(`Slug "${dto.slug}" is already in use`);
      }
    }

    return this.prisma.homepageGallery.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.homepageGallery.delete({ where: { id } });
  }

  async reorder(orderedIds: number[]) {
    const updates = orderedIds.map((id, index) =>
      this.prisma.homepageGallery.update({
        where: { id },
        data: { sortOrder: index },
      }),
    );
    return this.prisma.$transaction(updates);
  }
}
