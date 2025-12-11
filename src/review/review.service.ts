/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';

@Injectable()
export class ReviewService {
  private reviews = [];

  getAll() {
    return this.reviews;
  }

  add(userId: string, dto: any) {
    console.log(userId, dto);
    // const review = { id: Date.now(), userId, ...dto };
    // this.reviews.push(review);
    // return review;
  }

  getProductReviews(productId: string) {
    console.log(productId);
    // return this.reviews.filter(r => r.productId === productId);
  }

  getRandomReviews() {
    return this.reviews.sort(() => 0.5 - Math.random()).slice(0, 5);
  }

  update(id: any, dto: any) {
    console.log(id,dto);
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
