/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';

@Injectable()
export class RecommendationsService {
  private recentlyViewed = {}; // { userId: [productId] }

  getRecentlyViewed(userId: string) {
    return this.recentlyViewed[userId] || [];
  }

  addRecentlyViewed(userId: string, productId: number) {
    if (!this.recentlyViewed[userId]) this.recentlyViewed[userId] = [];
    this.recentlyViewed[userId].unshift(productId);
    this.recentlyViewed[userId] = this.recentlyViewed[userId].slice(0, 10); // keep last 10
    return this.recentlyViewed[userId];
  }

  clearRecentlyViewed(userId: string) {
    this.recentlyViewed[userId] = [];
    return { message: 'Recently viewed cleared' };
  }

  getRecommendations(userId: string) {
    console.log(`Generating recommendations for user ${userId}`);
    // Mock: return some sample products
    return [101, 102, 103];
  }

  getSimilarRecommendations(productId: string) {
    console.log(`Generating similar recommendations for product ${productId}`);
    // Mock: return similar product IDs
    return [201, 202, 203];
  }
}
