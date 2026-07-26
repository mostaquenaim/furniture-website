// src/label-size/label-size.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLabelSizeDto, UpdateLabelSizeDto } from './dto/label-size.dto';

@Injectable()
export class LabelSizeService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.labelSize.findMany({ orderBy: { id: 'asc' } });
  }

  async create(dto: CreateLabelSizeDto) {
    if (dto.isDefault) {
      await this.prisma.labelSize.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }
    return this.prisma.labelSize.create({ data: dto });
  }

  async update(id: number, dto: UpdateLabelSizeDto) {
    const existing = await this.prisma.labelSize.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Label size not found');

    if (dto.isDefault) {
      await this.prisma.labelSize.updateMany({
        where: { isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
    }
    return this.prisma.labelSize.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    const existing = await this.prisma.labelSize.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Label size not found');

    await this.prisma.labelSize.delete({ where: { id } });
    return { success: true };
  }

  async setDefault(id: number) {
    const existing = await this.prisma.labelSize.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Label size not found');

    await this.prisma.labelSize.updateMany({
      where: { isDefault: true, NOT: { id } },
      data: { isDefault: false },
    });
    return this.prisma.labelSize.update({
      where: { id },
      data: { isDefault: true },
    });
  }
}
