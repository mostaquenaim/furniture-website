/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class WishlistService {
  constructor(private prisma: PrismaService) {}

  //  get wishlist
  async getWishlist(
    userId: number,
    {
      page = 1,
      limit = 8,
    }: {
      page?: number;
      limit?: number;
    },
  ) {
    const skip = (page - 1) * limit;

    const where = {
      userId,
      isActive: true,
      product: {
        isActive: true,
      },
    };

    const [wishlistItems, total] = await this.prisma.$transaction([
      this.prisma.wishlist.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          product: {
            include: {
              images: true,
              colors: {
                include: { color: true },
              },
              subCategories: {
                include: {
                  subCategory: {
                    select: {
                      id: true,
                      name: true,
                      slug: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),

      this.prisma.wishlist.count({ where }),
    ]);

    // normalize → return products directly
    const products = wishlistItems.map((item) => ({
      ...item.product,
      wishlistId: item.id,
      addedAt: item.createdAt,
    }));

    return {
      data: products,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
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

  // delete a wish
  async removeItem(productId: number, userId: number) {
    // console.log(productId, userId);
    // Check if item exists and belongs to user
    const item = await this.prisma.wishlist.findFirst({
      where: { productId, userId },
    });

    if (!item) {
      throw new NotFoundException('Item not found in your wishlist');
    }

    return this.prisma.wishlist.delete({
      where: { id: item.id },
    });
  }

  // remove many items / bulk-delete
  async removeManyItems(ids: number[], userId: number) {
    if (!ids || ids.length === 0) return { count: 0 };

    return this.prisma.wishlist.deleteMany({
      where: {
        id: { in: ids },
        userId: userId, // Security: Ensure user owns these records
      },
    });
  }
}
