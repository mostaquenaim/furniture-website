import { Module } from '@nestjs/common';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [ReviewController],
  providers: [ReviewService, PrismaService]
})
export class ReviewModule {}
