// src/admin-notifications/admin-notifications.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { OrderStatus, Prisma, ReturnRequestStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StockEventsGateway } from '../realtime/stock-events.gateway';

export interface CreateAdminNotificationInput {
  type: string;
  title: string;
  message: string;
  link?: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AdminNotificationsService {
  private readonly logger = new Logger(AdminNotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private stockEventsGateway: StockEventsGateway,
  ) {}

  async createAdminNotification(input: CreateAdminNotificationInput) {
    return this.prisma.adminNotification.create({ data: input });
  }

  /**
   * Persist a notification and push it to connected staff over the
   * /inventory socket. Call it after the caller's transaction has committed,
   * and don't await it on a customer request path: it never throws, so a
   * notification failure can't fail or slow down the action that caused it.
   */
  async notify(input: CreateAdminNotificationInput): Promise<void> {
    try {
      const notification = await this.createAdminNotification(input);
      const unreadCount = await this.getUnreadCount();
      this.stockEventsGateway.emitAdminNotification({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        link: notification.link,
        createdAt: notification.createdAt,
        unreadCount,
      });
    } catch (err) {
      this.logger.error(
        `Failed to send admin notification (${input.type})`,
        err,
      );
    }
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

  // Sidebar badges: work still waiting on staff, not unread notifications,
  // so a badge clears once the order/return is handled rather than when
  // someone opens the bell. Same PENDING definition as the All Orders tab.
  async getBadgeCounts() {
    const [pendingOrders, pendingReturns, pendingRefunds] = await Promise.all([
      this.prisma.order.count({ where: { status: OrderStatus.PENDING } }),
      this.prisma.returnRequest.count({
        where: { status: ReturnRequestStatus.PENDING },
      }),
      this.countRefundsNeedingAction(),
    ]);
    return { pendingOrders, pendingReturns, pendingRefunds };
  }

  /**
   * Refunds an admin still has to finish: PENDING/PROCESSING ones (manual
   * refunds wait for "Complete", gateway ones for "Sync" — nothing settles
   * them automatically), plus FAILED ones that are still the latest attempt
   * on their payment. A retry creates a new refund row and leaves the failed
   * one behind, so an older failure must stop counting once it's retried.
   */
  private async countRefundsNeedingAction(): Promise<number> {
    const [row] = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count
      FROM "PaymentRefund" r
      WHERE r.status IN ('PENDING', 'PROCESSING')
         OR (
           r.status = 'FAILED'
           AND NOT EXISTS (
             SELECT 1 FROM "PaymentRefund" later
             WHERE later."paymentId" = r."paymentId" AND later.id > r.id
           )
         )`;
    return Number(row?.count ?? 0);
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
