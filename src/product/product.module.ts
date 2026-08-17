import { Module } from '@nestjs/common';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { BarcodeService } from 'src/barcode/barcode.service';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { ReviewService } from 'src/review/review.service';
import { PieceModule } from 'src/piece/piece.module';
import { PermissionService } from 'src/permission/permission.service';

@Module({
  imports: [PieceModule],
  controllers: [ProductController],
  providers: [
    ProductService,
    PrismaService,
    BarcodeService,
    ActivityLogService,
    ReviewService,
    PermissionService,
  ],
})
export class ProductModule {}
