import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Permission } from 'src/permission/permission.decorator';
import { Action } from 'src/permission/action.enum';
import { PrismaService } from 'src/prisma/prisma.service';
import { DemoModeGuard } from './demo-mode.guard';
import {
  generateRandomBlogPost,
  generateRandomCategory,
  generateRandomCoupon,
  generateRandomProduct,
} from './demo-seed';

/**
 * Backs the "Generate Random X" buttons shown on admin pages in demo/dev
 * only (see DemoModeGuard). Each entity reuses the exact same fake-data
 * factories prisma/seed.ts uses for bulk seeding — one implementation for
 * both bulk and one-off generation.
 */
@Controller('demo/generate')
@UseGuards(JwtAuthGuard, RolesGuard, DemoModeGuard)
export class DemoGenerateController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('product')
  @Permission(Action.PRODUCT_CREATE)
  generateProduct() {
    return generateRandomProduct(this.prisma);
  }

  @Post('category')
  @Permission(Action.CATEGORY_CREATE)
  generateCategory() {
    return generateRandomCategory(this.prisma);
  }

  @Post('blog-post')
  @Permission(Action.BLOG_CREATE)
  generateBlogPost() {
    return generateRandomBlogPost(this.prisma);
  }

  @Post('coupon')
  @Permission(Action.COUPON_CREATE)
  generateCoupon() {
    return generateRandomCoupon(this.prisma);
  }
}
