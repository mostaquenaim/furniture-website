// src/admin-notifications/admin-notifications.service.ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateAdminNotificationInput {
  type: string;
  title: string;
  message: string;
  link?: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AdminNotificationsService {
  constructor(private prisma: PrismaService) {}

  async create(input: CreateAdminNotificationInput) {
    return this.prisma.adminNotification.create({ data: input });
  }

  async list(limit = 30) {
    const [items, unreadCount] = await Promise.all([
      this.prisma.adminNotification.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.adminNotification.count({ where: { readAt: null } }),
    ]);
    return { items, unreadCount };
  }

  async markRead(id: number) {
    await this.prisma.adminNotification.updateMany({
      where: { id, readAt: null },
      data: { readAt: new Date() },
    });
    return this.unreadCount();
  }

  async markAllRead() {
    await this.prisma.adminNotification.updateMany({
      where: { readAt: null },
      data: { readAt: new Date() },
    });
    return this.unreadCount();
  }

  async getUnreadCount() {
    return this.prisma.adminNotification.count({ where: { readAt: null } });
  }

  private async unreadCount() {
    const unreadCount = await this.getUnreadCount();
    return { unreadCount };
  }
}
