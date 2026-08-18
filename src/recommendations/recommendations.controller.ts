/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Controller, Get, Post, Delete, Param, Body, Query } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';

@Controller()
export class RecommendationsController {
  constructor(private readonly service: RecommendationsService) {}

  @Get('recently-viewed')
  getRecentlyViewed(@Query('userId') userId: string) {
    return this.service.getRecentlyViewed(userId);
  }

  @Post('recently-viewed')
  addRecentlyViewed(@Body() body: { userId: string; productId: number }) {
    return this.service.addRecentlyViewed(body.userId, body.productId);
  }

  @Delete('recently-viewed')
  clearRecentlyViewed(@Body() body: { userId: string }) {
    return this.service.clearRecentlyViewed(body.userId);
  }

  @Get('recommendations')
  getRecommendations(@Query('userId') userId: string) {
    return this.service.getRecommendations(userId);
  }

  @Get('recommendations/:productId')
  getSimilarRecommendations(@Param('productId') productId: string) {
    return this.service.getSimilarRecommendations(productId);
  }
}
