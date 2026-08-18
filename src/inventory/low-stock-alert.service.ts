import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UserRole } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  NotificationsService,
  LowStockAlertItem,
} from 'src/notifications/notifications.service';
import { Action } from 'src/permission/action.enum';
import { InventoryService } from './inventory.service';

/**
 * Daily digest of out-of-stock / low-stock variants, emailed to whichever admin
 * roles currently hold INVENTORY_VIEW (SUPERADMIN always included, since it
 * bypasses the RolePermission table everywhere else in the app). This runs
 * alongside, not instead of, StockEventsGateway's per-adjustment 'stock:low'
 * websocket push — the socket is for live dashboards, this is the net that
 * catches it if nobody was watching the dashboard that day.
 */
@Injectable()
export class LowStockAlertService {
  private readonly logger = new Logger(LowStockAlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM, {
    name: 'low-stock-alert',
    timeZone: 'Asia/Dhaka',
  })
  async handleDailyCheck() {
    try {
      await this.run();
    } catch (err) {
      this.logger.error('Low-stock alert run failed', err);
    }
  }

  async run() {
    const { items } = await this.inventoryService.getLowStockSummary();

    if (items.length === 0) {
      this.logger.log('Low-stock check: nothing at or below threshold');
      return;
    }

    const recipients = await this.getAlertRecipients();
    if (recipients.length === 0) {
      this.logger.warn(
        `${items.length} item(s) below threshold but no admin currently has INVENTORY_VIEW — skipping email`,
      );
      return;
    }

    const toAlertItem = (item: (typeof items)[number]): LowStockAlertItem => ({
      productTitle: item.product.title,
      sku: item.sku ?? item.product.sku ?? null,
      size: item.size,
      color: item.color,
      quantity: item.quantity,
      lowStockAt: item.lowStockAt,
    });

    const outOfStock = items.filter((i) => i.quantity <= 0).map(toAlertItem);
    const lowStock = items.filter((i) => i.quantity > 0).map(toAlertItem);

    await this.notificationsService.sendLowStockAlert(recipients, {
      outOfStock,
      lowStock,
      generatedAt: new Date(),
    });

    this.logger.log(
      `Low-stock alert sent to ${recipients.length} admin(s): ${outOfStock.length} out of stock, ${lowStock.length} low stock`,
    );
  }

  /** SUPERADMIN always sees inventory; other roles only if a superadmin granted them INVENTORY_VIEW. */
  private async getAlertRecipients(): Promise<string[]> {
    const grantedRoles = await this.prisma.rolePermission.findMany({
      where: { action: Action.INVENTORY_VIEW, enabled: true },
      select: { role: true },
    });

    const roles = new Set<UserRole>([
      UserRole.SUPERADMIN,
      ...grantedRoles.map((r) => r.role),
    ]);

    const admins = await this.prisma.user.findMany({
      where: {
        role: { in: Array.from(roles) },
        isActive: true,
        email: { not: null },
      },
      select: { email: true },
    });

    return admins.map((a) => a.email).filter((e): e is string => !!e);
  }
}
