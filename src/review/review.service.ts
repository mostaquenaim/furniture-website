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
import { ActivityLogService } from 'src/activity-log/activity-log.service';

@Injectable()
export class ReviewService {
  constructor(
    private prisma: PrismaService,
    private activityLogService: ActivityLogService,
  ) {}
  private reviews = [];

  getAll() {
    return this.reviews;
  }

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

  async updateReview(
    id: number,
    data: { isHidden?: boolean; isFeatured?: boolean },
    adminId: number,
  ) {
    // 1. Fetch existing review
    const review = await this.prisma.review.findUnique({
      where: { id },
      include: {
        orderItem: {
          select: {
            product: {
              select: {
                title: true,
              },
            },
          },
        },
      },
    });
    if (!review) throw new NotFoundException(`Review with ID ${id} not found`);

    // 2. Enforce business rule: cannot be hidden and featured at the same time
    if (data.isHidden && data.isFeatured) {
      throw new BadRequestException(
        'A review cannot be hidden and featured at the same time',
      );
    }
    if (data.isHidden && review.isFeatured) {
      // if hiding, unfeature
      data.isFeatured = false;
    }
    if (data.isFeatured && review.isHidden) {
      // if featuring, unhide
      data.isHidden = false;
    }

    // 3. Update
    const updated = await this.prisma.review.update({
      where: { id },
      data: {
        ...(data.isHidden !== undefined && { isHidden: data.isHidden }),
        ...(data.isFeatured !== undefined && { isFeatured: data.isFeatured }),
      },
    });

    // 4. Log activity
    await this.activityLogService.log({
      adminId,
      action: 'UPDATE_REVIEW',
      module: 'PRODUCT',
      targetId: review.id,
      targetLabel: review.orderItem.product.title, // or any label you want
      oldValue: { isHidden: review.isHidden, isFeatured: review.isFeatured },
      newValue: { isHidden: updated.isHidden, isFeatured: updated.isFeatured },
    });

    return updated;
  }

  async getAFeaturedReview() {
    // Fetch all featured reviews
    const reviews = await this.prisma.review.findMany({
      where: {
        isFeatured: true,
      },
      include: {
        orderItem: {
          select: {
            productId: true,
            product: {
              select: {
                title: true,
                slug: true,
              },
            },
            order: {
              select: {
                userId: true,
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // If no featured reviews, return null
    if (!reviews || reviews.length === 0) {
      return null;
    }

    // Pick a random review from the array
    const randomIndex = Math.floor(Math.random() * reviews.length);
    return reviews[randomIndex];
  }

  async getAllFeaturedReviews() {
    const reviews = await this.prisma.review.findMany({
      where: {
        isFeatured: true,
        isHidden: false,
        comment: { not: null },
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        orderItem: {
          select: {
            productId: true,
            product: {
              select: {
                title: true,
                slug: true,
              },
            },
            order: {
              select: {
                userId: true,
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return reviews;
  }

  getProductReviews(productId: string) {}

  getRandomReviews() {
    return this.reviews.sort(() => 0.5 - Math.random()).slice(0, 5);
  }

  update(id: any, dto: any) {}

  delete(id: any) {}
}
