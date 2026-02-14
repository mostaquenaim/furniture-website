/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get()
  getAll() {
    return this.reviewService.getAll();
  }

  @Post('/:orderItemId')
  createReview(
    @Req() req: any,
    @Param('orderItemId') orderItemId: number,
    @Body() reviewDto: CreateReviewDto,
  ) {
    return this.reviewService.createReview(
      req?.user?.userId,
      orderItemId,
      reviewDto,
    );
  }

  @Get('product/:productId')
  getProductReviews(@Param('productId') productId: string) {
    return this.reviewService.getProductReviews(productId);
  }

  @Get('random')
  getRandomReviews() {
    return this.reviewService.getRandomReviews();
  }

  @Put(':id')
  updateReview(@Param('id') id: string, @Body() dto: UpdateReviewDto) {
    return this.reviewService.update(id, dto);
  }

  @Delete(':id')
  deleteReview(@Param('id') id: string) {
    return this.reviewService.delete(id);
  }
}
