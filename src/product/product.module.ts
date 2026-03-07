import { Module } from '@nestjs/common';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { BarcodeService } from 'src/barcode/barcode.service';
import { ActivityLogService } from 'src/activity-log/activity-log.service';

@Module({
  controllers: [ProductController],
  providers: [
    ProductService,
    PrismaService,
    BarcodeService,
    ActivityLogService,
  ],
})
export class ProductModule {}
