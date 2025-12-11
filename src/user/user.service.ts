import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { SuspendUserDto } from './dto/suspend-user.dto';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  // List all users
  findAll() {
    return this.prisma.user.findMany();
  }

  // Get single user
  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // Update user
  update(id: number, dto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data: dto,
    });
  }

  // Delete user
  async remove(id: number) {
    await this.findOne(id); // check existence
    return this.prisma.user.delete({ where: { id } });
  }

  // Get user orders
  getOrders(userId: number) {
    return this.prisma.order.findMany({ where: { userId }, include: { items: true } });
  }

  // Get user wishlist
  getWishlist(userId: number) {
    return this.prisma.wishlist.findMany({ where: { userId }, include: { product: true } });
  }

  // Get user reviews
  getReviews(userId: number) {
    return this.prisma.review.findMany({ where: { userId }, include: { product: true } });
  }

  // Hide/Select user reviews
  hideReviews(userId: number, reviewIds: number[], hide = true) {
    return this.prisma.review.updateMany({
      where: { id: { in: reviewIds }, userId },
      data: { comment: hide ? null : undefined }, // null = hidden
    });
  }

  // Suspend user (fraud)
  suspendUser(dto: SuspendUserDto) {
    return this.prisma.user.update({
      where: { id: dto.userId },
      data: { role: 'CUSTOMER' }, // optionally, add a `suspended` boolean in schema
    });
  }
}
