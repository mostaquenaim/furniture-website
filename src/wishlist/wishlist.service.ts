/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable } from '@nestjs/common';

@Injectable()
export class WishlistService {
  private wishlist = {}; // mock in-memory

  getWishlist(userId: string) {
    return this.wishlist[userId] || [];
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
    this.wishlist[userId] = this.wishlist[userId].filter(id => id !== productId);

    return { message: 'Removed from wishlist', wishlist: this.wishlist[userId] };
  }
}
