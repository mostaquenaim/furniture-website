/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class WishlistService {
  constructor(private prisma: PrismaService) {}

  private wishlist = {}; // mock in-memory

  async getWishlist(userId: number, page = 1, limit = 8) {
    const skip = (page - 1) * limit;

    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.wishlist.findMany({
        where: {
          userId,
          isActive: true,
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          product: true,
        },
      }),
      this.prisma.wishlist.count({
        where: {
          userId,
          isActive: true,
        },
      }),
    ]);

    return {
      items,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
    };
  }

  add(userId: string, productId: string) {
    if (!this.wishlist[userId]) this.wishlist[userId] = [];
    if (!this.wishlist[userId].includes(productId)) {
      this.wishlist[userId].push(productId);
    }
    return { message: 'Added to wishlist', wishlist: this.wishlist[userId] };
  }

  remove(userId: string, productId: string) {
    if (!this.wishlist[userId]) return [];
    this.wishlist[userId] = this.wishlist[userId].filter(
      (id) => id !== productId,
    );

    return {
      message: 'Removed from wishlist',
      wishlist: this.wishlist[userId],
    };
  }
}
