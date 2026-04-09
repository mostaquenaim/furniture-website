import { Module } from '@nestjs/common';
import { SeasonalCategoryController } from './seasonal-category.controller';
import { SeasonalCategoryService } from './seasonal-category.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { PermissionService } from 'src/permission/permission.service';

@Module({
  controllers: [SeasonalCategoryController],
  providers: [SeasonalCategoryService, PrismaService, PermissionService],
})
export class SeasonalCategoryModule {}
