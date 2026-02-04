import { Module } from '@nestjs/common';
import { CmsController } from './cms.controller';
import { CmsService } from './cms.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CartService } from 'src/cart/cart.service';

@Module({
  controllers: [CmsController],
  providers: [CmsService, PrismaService, CartService],
})
export class CmsModule {}
