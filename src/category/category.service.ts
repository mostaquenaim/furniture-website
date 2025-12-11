import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { UpdateSubcategoryDto } from './dto/update-subcategory.dto';

import { AddRoomDto } from './dto/add-room.dto';

@Injectable()
export class CategoryService {
  constructor(private prisma: PrismaService) {}

  // ===== Category =====
  createCategory(dto: CreateCategoryDto) {
    return this.prisma.category.create({ data: dto });
  }

  findAllCategories() {
    return this.prisma.category.findMany({ include: { subcategories: true } });
  }

  findCategoryById(id: number) {
    return this.prisma.category.findUnique({ where: { id }, include: { subcategories: true } });
  }

  updateCategory(id: number, dto: UpdateCategoryDto) {
    return this.prisma.category.update({ where: { id }, data: dto });
  }

  deleteCategory(id: number) {
    return this.prisma.category.delete({ where: { id } });
  }

  getCategoryProducts(id: number) {
    return this.prisma.product.findMany({
      where: { subcategory: { categoryId: id } },
    });
  }

  // ===== Subcategory =====
  createSubcategory(dto: CreateSubcategoryDto) {
    return this.prisma.subcategory.create({ data: dto });
  }

  findAllSubcategories() {
    return this.prisma.subcategory.findMany({ include: { category: true, rooms: true } });
  }

  findSubcategoryById(id: number) {
    return this.prisma.subcategory.findUnique({ where: { id }, include: { rooms: true, category: true } });
  }

  updateSubcategory(id: number, dto: UpdateSubcategoryDto) {
    return this.prisma.subcategory.update({ where: { id }, data: dto });
  }

  deleteSubcategory(id: number) {
    return this.prisma.subcategory.delete({ where: { id } });
  }

  // ===== Subcategory-Room =====
  getSubcategoryRooms(id: number) {
    return this.prisma.subcategory.findUnique({
      where: { id },
      include: { rooms: true },
    });
  }

  addRoomToSubcategory(subcategoryId: number, dto: AddRoomDto) {
    return this.prisma.subcategory.update({
      where: { id: subcategoryId },
      data: {
        rooms: { connect: { id: dto.roomId } },
      },
      include: { rooms: true },
    });
  }

  removeRoomFromSubcategory(subcategoryId: number, roomId: number) {
    return this.prisma.subcategory.update({
      where: { id: subcategoryId },
      data: { rooms: { disconnect: { id: roomId } } },
      include: { rooms: true },
    });
  }
}
