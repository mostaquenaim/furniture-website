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

  // toggle wishlist
  async toggleWishlist(userId: number, productId: number) {
    const existing = await this.prisma.wishlist.findUnique({
      where: {
        userId_productId: { userId, productId },
      },
    });

    if (!existing) {
      await this.prisma.wishlist.create({
        data: { userId, productId },
      });
      return { isWished: true };
    }

    const updated = await this.prisma.wishlist.update({
      where: { id: existing.id },
      data: { isActive: !existing.isActive },
    });

    return { isWished: updated.isActive };
  }

  // check if wished
  async getIsWished(userId: number, productSlug: string) {
    const wishlist = await this.prisma.wishlist.findFirst({
      where: {
        userId,
        isActive: true,
        product: {
          slug: productSlug,
        },
      },
      select: {
        id: true,
      },
    });

    return {
      isWished: !!wishlist,
    };
  }
}
