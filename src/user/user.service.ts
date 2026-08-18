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
import { ActivityLogService } from 'src/activity-log/activity-log.service';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private activityLogService: ActivityLogService,
  ) {}

  findAll() {
    return this.prisma.user.findMany({ select: SAFE_USER_SELECT });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: SAFE_USER_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async remove(id: number, adminId: number) {
    return deleteUserSafely(this.prisma, id, {
      service: this.activityLogService,
      adminId,
      action: 'DELETE_CUSTOMER',
    });
  }

  getOrders(userId: number) {
    return this.prisma.order.findMany({
      where: { userId },
      include: { items: true },
    });
  }

  getWishlist(userId: number) {
    return this.prisma.wishlist.findMany({
      where: { userId },
      include: { product: true },
    });
  }

  // Suspend user (fraud) — reuses the same `isActive` flag toggleStatus()
  // (admin-user.service.ts) already uses, so suspend/reactivate is one
  // consistent mechanism instead of two.
  async suspendUser(dto: SuspendUserDto, adminId: number) {
    const user = await this.findOne(dto.userId);
    if (user.role === UserRole.SUPERADMIN) {
      throw new ForbiddenException('Cannot suspend a SUPERADMIN account.');
    }
    const updated = await this.prisma.user.update({
      where: { id: dto.userId },
      data: { isActive: false },
      select: SAFE_USER_SELECT,
    });

    await this.activityLogService.log({
      adminId,
      action: 'SUSPEND_CUSTOMER',
      module: 'USER',
      targetId: dto.userId,
      targetLabel: user.name ?? user.email ?? user.phone ?? String(dto.userId),
      severity: 'WARNING',
      oldValue: { isActive: user.isActive },
      newValue: { isActive: updated.isActive },
    });

    return updated;
  }
}
