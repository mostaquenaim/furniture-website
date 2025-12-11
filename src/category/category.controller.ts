import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { CategoryService } from './category.service';
import { AddRoomDto } from './dto/add-room.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { UpdateSubcategoryDto } from './dto/update-subcategory.dto';

import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller()
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  // ===== Category =====
  @Post('categories')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.categoryService.createCategory(dto);
  }

  @Get('categories')
  findAllCategories() {
    return this.categoryService.findAllCategories();
  }

  @Get('categories/:id')
  findCategoryById(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.findCategoryById(id);
  }

  @Put('categories/:id')
  updateCategory(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCategoryDto) {
    return this.categoryService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  deleteCategory(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.deleteCategory(id);
  }

  @Get('categories/:id/products')
  getCategoryProducts(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.getCategoryProducts(id);
  }

  // ===== Subcategory =====
  @Post('subcategories')
  createSubcategory(@Body() dto: CreateSubcategoryDto) {
    return this.categoryService.createSubcategory(dto);
  }

  @Get('subcategories')
  findAllSubcategories() {
    return this.categoryService.findAllSubcategories();
  }

  @Get('subcategories/:id')
  findSubcategoryById(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.findSubcategoryById(id);
  }

  @Put('subcategories/:id')
  updateSubcategory(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSubcategoryDto) {
    return this.categoryService.updateSubcategory(id, dto);
  }

  @Delete('subcategories/:id')
  deleteSubcategory(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.deleteSubcategory(id);
  }

  // ===== Subcategory Rooms =====
  @Get('subcategories/:id/rooms')
  getSubcategoryRooms(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.getSubcategoryRooms(id);
  }

  @Post('subcategories/:id/rooms')
  addRoomToSubcategory(@Param('id', ParseIntPipe) id: number, @Body() dto: AddRoomDto) {
    return this.categoryService.addRoomToSubcategory(id, dto);
  }

  @Delete('subcategories/:id/rooms/:roomId')
  removeRoomFromSubcategory(@Param('id', ParseIntPipe) id: number, @Param('roomId', ParseIntPipe) roomId: number) {
    return this.categoryService.removeRoomFromSubcategory(id, roomId);
  }
}
