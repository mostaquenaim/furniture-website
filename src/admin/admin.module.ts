import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { CategoryService } from 'src/category/category.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [AdminController],
  providers: [AdminService, CategoryService, PrismaService]
})
export class AdminModule {}
