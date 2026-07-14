// src/supplier/supplier.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';

@Injectable()
export class SupplierService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateSupplierDto) {
    return this.prisma.supplier.create({ data: dto });
  }

  findAll(activeOnly = false) {
    return this.prisma.supplier.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  async update(id: number, dto: UpdateSupplierDto) {
    const existing = await this.prisma.supplier.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Supplier not found');

    return this.prisma.supplier.update({ where: { id }, data: dto });
  }
}
