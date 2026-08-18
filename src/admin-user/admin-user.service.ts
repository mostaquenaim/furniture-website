// src/admin-users/admin-users.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { hashPassword } from 'src/common/utils/password.utils';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { deleteUserSafely } from 'src/user/user-deletion.util';
import { SAFE_USER_SELECT } from 'src/user/safe-user.select';
import { ActivityLogService } from 'src/activity-log/activity-log.service';

const ADMIN_ROLES: UserRole[] = [
  UserRole.SUPERADMIN,
  UserRole.PRODUCTMANAGER,
  UserRole.ORDERMANAGER,
  UserRole.SUPPORT,
];

const MANAGEABLE_ROLES: UserRole[] = [
  UserRole.PRODUCTMANAGER,
  UserRole.ORDERMANAGER,
  UserRole.SUPPORT,
];

@Injectable()
export class AdminUsersService {
  constructor(
    private prisma: PrismaService,
    private activityLogService: ActivityLogService,
  ) {}

  // ── Get all admin users ────────────────────────────────────────────────────
  async getAdminUsers() {
    return this.prisma.user.findMany({
      where: { role: { in: ADMIN_ROLES } },
      select: SAFE_USER_SELECT,
      orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
    });
  }

  // ── Create admin user ──────────────────────────────────────────────────────
  async createAdminUser(dto: CreateAdminUserDto, adminId: number) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Either email or phone is required.');
    }

    if (!MANAGEABLE_ROLES.includes(dto.role)) {
      throw new ForbiddenException(
        'Cannot create a user with SUPERADMIN role.',
      );
    }

    // Check uniqueness
    if (dto.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existing) throw new BadRequestException('Email already in use.');
    }

    if (dto.phone) {
      const existing = await this.prisma.user.findUnique({
        where: { phone: dto.phone },
      });
      if (existing) throw new BadRequestException('Phone already in use.');
    }

    let hashed = '';
    if (dto.password) {
      hashed = await hashPassword(dto.password);
    }

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        password: hashed || null,
        role: dto.role,
        isVerified: true,
        isActive: true,
      },
      select: SAFE_USER_SELECT,
    });

    await this.activityLogService.log({
      adminId,
      action: 'CREATE_ADMIN_USER',
      module: 'USER',
      targetId: user.id,
      targetLabel: user.name ?? user.email ?? user.phone ?? String(user.id),
      newValue: { name: user.name, email: user.email, role: user.role },
    });

    return { message: 'Admin user created successfully.', data: user };
  }

  // ── Change role ────────────────────────────────────────────────────────────
  async changeRole(id: number, role: UserRole, adminId: number) {
    if (!MANAGEABLE_ROLES.includes(role)) {
      throw new ForbiddenException(
        'Cannot assign SUPERADMIN or CUSTOMER role.',
      );
    }

    const user = await this.findAdminUserOrThrow(id);

    if (user.role === UserRole.SUPERADMIN) {
      throw new ForbiddenException("Cannot change a SUPERADMIN's role.");
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { role },
      select: SAFE_USER_SELECT,
    });

    await this.activityLogService.log({
      adminId,
      action: 'CHANGE_ADMIN_ROLE',
      module: 'USER',
      targetId: id,
      targetLabel: user.name ?? user.email ?? user.phone ?? String(id),
      oldValue: { role: user.role },
      newValue: { role: updated.role },
    });

    return { message: 'Role updated successfully.', data: updated };
  }

  // ── Toggle active status ───────────────────────────────────────────────────
  async toggleStatus(id: number, isActive: boolean, adminId: number) {
    const user = await this.findAdminUserOrThrow(id);

    if (user.role === UserRole.SUPERADMIN) {
      throw new ForbiddenException('Cannot deactivate a SUPERADMIN account.');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive },
      select: SAFE_USER_SELECT,
    });

    await this.activityLogService.log({
      adminId,
      action: isActive ? 'ENABLE_ADMIN_USER' : 'DISABLE_ADMIN_USER',
      module: 'USER',
      targetId: id,
      targetLabel: user.name ?? user.email ?? user.phone ?? String(id),
      oldValue: { isActive: user.isActive },
      newValue: { isActive: updated.isActive },
    });

    return {
      message: `User ${isActive ? 'reactivated' : 'deactivated'} successfully.`,
      data: updated,
    };
  }

  // ── Reset password ─────────────────────────────────────────────────────────
  async resetPassword(id: number, adminId: number) {
    const user = await this.findAdminUserOrThrow(id);

    if (!user.email) {
      throw new BadRequestException(
        'User has no email address to send reset link to.',
      );
    }

    // Generate a temporary password
    const tempPassword = this.generateTempPassword();
    const hashed = await hashPassword(tempPassword);

    await this.prisma.user.update({
      where: { id },
      data: { password: hashed },
    });

    // TODO: plug in your mail service here
    // await this.mailService.sendPasswordReset(user.email, tempPassword);

    await this.activityLogService.log({
      adminId,
      action: 'RESET_ADMIN_PASSWORD',
      module: 'USER',
      targetId: id,
      targetLabel: user.name ?? user.email ?? String(id),
      severity: 'WARNING',
    });

    return {
      message: `Password reset. Temporary password sent to ${user.email}.`,
      // Remove tempPassword from response in production — use email only
      tempPassword:
        process.env.NODE_ENV !== 'production' ? tempPassword : undefined,
    };
  }

  async deleteUser(id: number, adminId: number) {
    return deleteUserSafely(this.prisma, id, {
      service: this.activityLogService,
      adminId,
      action: 'DELETE_ADMIN_USER',
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  private async findAdminUserOrThrow(id: number) {
    const user = await this.prisma.user.findFirst({
      where: { id, role: { in: ADMIN_ROLES } },
    });
    if (!user) throw new NotFoundException('Admin user not found.');
    return user;
  }

  private generateTempPassword(): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    return Array.from({ length: 12 })
      .map(() => chars[Math.floor(Math.random() * chars.length)])
      .join('');
  }
}
