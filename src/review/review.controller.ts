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
import { RolesGuard } from 'src/auth/roles.guard';
import { Permission } from 'src/permission/permission.decorator';
import { Action } from 'src/permission/action.enum';

@UseGuards(JwtAuthGuard)
@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  // Raw/unfiltered listing — moderation-shaped, not the public product feed
  // (that's GET product/:productId below). Gated the same as the real
  // moderation endpoint in admin.controller.ts.
  @Get()
  @UseGuards(RolesGuard)
  @Permission(Action.REVIEW_MANAGE)
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
  @UseGuards(RolesGuard)
  @Permission(Action.REVIEW_MANAGE)
  updateReview(@Param('id') id: string, @Body() dto: UpdateReviewDto) {
    return this.reviewService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Permission(Action.REVIEW_MANAGE)
  deleteReview(@Param('id') id: string) {
    return this.reviewService.delete(id);
  }
}
