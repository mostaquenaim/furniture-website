import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { SuspendUserDto } from './dto/suspend-user.dto';
import { UserRole } from '@prisma/client';
import { deleteUserSafely } from './user-deletion.util';
import { SAFE_USER_SELECT } from './safe-user.select';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  // List all users
  findAll() {
    return this.prisma.user.findMany({ select: SAFE_USER_SELECT });
  }

  // Get single user
  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: SAFE_USER_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // Delete user
  async remove(id: number) {
    return deleteUserSafely(this.prisma, id);
  }

  // Get user orders
  getOrders(userId: number) {
    return this.prisma.order.findMany({
      where: { userId },
      include: { items: true },
    });
  }

  // Get user wishlist
  getWishlist(userId: number) {
    return this.prisma.wishlist.findMany({
      where: { userId },
      include: { product: true },
    });
  }

  // Suspend user (fraud) — reuses the same `isActive` flag toggleStatus()
  // (admin-user.service.ts) already uses, so suspend/reactivate is one
  // consistent mechanism instead of two.
  async suspendUser(dto: SuspendUserDto) {
    const user = await this.findOne(dto.userId);
    if (user.role === UserRole.SUPERADMIN) {
      throw new ForbiddenException('Cannot suspend a SUPERADMIN account.');
    }
    return this.prisma.user.update({
      where: { id: dto.userId },
      data: { isActive: false },
      select: SAFE_USER_SELECT,
    });
  }
}
