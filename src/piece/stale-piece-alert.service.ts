import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UserRole } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  NotificationsService,
  StalePieceAlertItem,
} from 'src/notifications/notifications.service';
import { Action } from 'src/permission/action.enum';
import { PieceService, STALE_PIECE_DAYS } from './piece.service';

/**
 * Daily digest of barcode batches still sitting in CREATED past the stale
 * threshold — the print-side counterpart to LowStockAlertService. These
 * pieces were never counted as in-stock, so this never touches
 * ProductSize.quantity; it's purely a reminder to receive or void them.
 */
@Injectable()
export class StalePieceAlertService {
  private readonly logger = new Logger(StalePieceAlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pieceService: PieceService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM, {
    name: 'stale-piece-alert',
    timeZone: 'Asia/Dhaka',
  })
  async handleDailyCheck() {
    try {
      await this.run();
    } catch (err) {
      this.logger.error('Stale-piece alert run failed', err);
    }
  }

  async run() {
    const batches = await this.pieceService.getStaleBatches(STALE_PIECE_DAYS);

    if (batches.length === 0) {
      this.logger.log('Stale-piece check: nothing past threshold');
      return;
    }

    const recipients = await this.getAlertRecipients();
    if (recipients.length === 0) {
      this.logger.warn(
        `${batches.length} stale batch(es) but no admin currently has PIECE_VIEW/PIECE_GENERATE — skipping email`,
      );
      return;
    }

    const items: StalePieceAlertItem[] = batches.map((b) => ({
      productTitle: b.productTitle,
      color: b.color,
      size: b.size,
      batchId: b.batchId,
      pending: b.pending,
      quantity: b.quantity,
      ageDays: b.ageDays,
    }));

    await this.notificationsService.sendStalePiecesAlert(recipients, {
      items,
      thresholdDays: STALE_PIECE_DAYS,
      generatedAt: new Date(),
    });

    this.logger.log(
      `Stale-piece alert sent to ${recipients.length} admin(s): ${batches.length} batch(es) past threshold`,
    );
  }

  /** SUPERADMIN always sees pieces; other roles only if granted PIECE_VIEW or PIECE_GENERATE. */
  private async getAlertRecipients(): Promise<string[]> {
    const grantedRoles = await this.prisma.rolePermission.findMany({
      where: {
        action: { in: [Action.PIECE_VIEW, Action.PIECE_GENERATE] },
        enabled: true,
      },
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
