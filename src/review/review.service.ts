/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewService {
  constructor(private prisma: PrismaService) {}
  private reviews = [];

  getAll() {
    return this.reviews;
  }

  // create a review
  async createReview(
    userId: number,
    orderItemId: number,
    reviewDto: CreateReviewDto,
  ) {
    const { rating, comment } = reviewDto;

    // Validate rating
    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    // Find order item with ownership + review check
    const orderItem = await this.prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: {
        order: true,
        review: true,
      },
    });

    if (!orderItem) {
      throw new NotFoundException('Order item not found');
    }

    // Ensure this order belongs to user
    if (orderItem.order.userId !== userId) {
      throw new ForbiddenException('You cannot review this item');
    }

    // Ensure order is delivered
    if (orderItem.order.status !== 'DELIVERED') {
      throw new BadRequestException(
        'You can only review items after delivery.',
      );
    }

    // Prevent duplicate review (extra safety)
    if (orderItem.review) {
      throw new BadRequestException('You have already reviewed this item.');
    }

    // Create review
    const review = await this.prisma.review.create({
      data: {
        rating,
        comment,
        orderItemId,
      },
    });

    await this.prisma.orderItem.update({
      where: {
        id: orderItemId,
      },
      data: {
        isReviewed: true,
      },
    });

    return {
      message: 'Review submitted successfully.',
      review,
    };
  }

  getProductReviews(productId: string) {
    console.log(productId);
    // return this.reviews.filter(r => r.productId === productId);
  }

  getRandomReviews() {
    return this.reviews.sort(() => 0.5 - Math.random()).slice(0, 5);
  }

  update(id: any, dto: any) {
    console.log(id, dto);
    // const index = this.reviews.findIndex(r => r.id == id);
    // if (index === -1) return null;

    // this.reviews[index] = { ...this.reviews[index], ...dto };
    // return this.reviews[index];
  }

  delete(id: any) {
    console.log(id);
    // this.reviews = this.reviews.filter(r => r?.id != id);
    // return { message: 'Review deleted' };
  }
}
