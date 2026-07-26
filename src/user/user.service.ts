import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { SuspendUserDto } from './dto/suspend-user.dto';
import { UserRole } from '@prisma/client';

// Never select `password` (bcrypt hash) or `googleId` out to API responses.
const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  isVerified: true,
  isActive: true,
  fraudStatus: true,
  avatar: true,
  createdAt: true,
  updatedAt: true,
} as const;

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
    const user = await this.findOne(id); // check existence
    if (user.role === UserRole.SUPERADMIN) {
      throw new ForbiddenException('Cannot delete a SUPERADMIN account.');
    }
    return this.prisma.user.delete({ where: { id } });
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

  // Suspend user (fraud)
  async suspendUser(dto: SuspendUserDto) {
    const user = await this.findOne(dto.userId);
    if (user.role === UserRole.SUPERADMIN) {
      throw new ForbiddenException('Cannot suspend a SUPERADMIN account.');
    }
    return this.prisma.user.update({
      where: { id: dto.userId },
      data: { role: 'CUSTOMER' }, // optionally, add a `suspended` boolean in schema
      select: SAFE_USER_SELECT,
    });
  }
}
