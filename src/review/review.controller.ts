/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Controller, Get, Post, Put, Delete, Body, Param, Req } from '@nestjs/common';
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get()
  getAll() {
    return this.reviewService.getAll();
  }

  @Post()
  addReview(@Body() dto: CreateReviewDto, @Req() req) {
    return this.reviewService.add(req.user.id, dto);
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
