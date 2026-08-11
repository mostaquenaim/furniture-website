// src/reservation/reservation.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PieceStatus, ShipmentGroupStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from 'src/activity-log/activity-log.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { StockEventsGateway } from 'src/realtime/stock-events.gateway';
import { ReservePieceDto } from './dto/reservation.dto';

const RESERVATION_INCLUDE = {
  piece: {
    include: {
      productSize: {
        include: {
          size: true,
          color: {
            include: {
              color: true,
              product: { select: { id: true, title: true } },
            },
          },
        },
      },
      location: true,
    },
  },
  orderItem: true,
} satisfies Prisma.OrderLineReservationInclude;

export interface ShipmentGroupGateResult {
  requiredCount: number;
  reservedCount: number;
  pickedCount: number;
  isFullyPicked: boolean;
}

@Injectable()
export class ReservationService {
  constructor(
    private prisma: PrismaService,
    private activityLogService: ActivityLogService,
    private notificationsService: NotificationsService,
    private stockEventsGateway: StockEventsGateway,
  ) {}

  private async resolveOrderByOrderId(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderId },
      include: { items: { include: { productSize: true } } },
    });
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }
    return order;
  }

  // ── Order Manager: pieces available to reserve for a variant ──────────────
  async getAvailablePieces(productSizeId: number) {
    return this.prisma.piece.findMany({
      where: {
        productSizeId,
        status: { in: [PieceStatus.IN_STOCK, PieceStatus.RETURNED_IN_STOCK] },
      },
      include: { location: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async getOrCreateShipmentGroup(
    tx: Prisma.TransactionClient,
    orderPk: number,
  ) {
    const existing = await tx.shipmentGroup.findUnique({
      where: { orderId: orderPk },
    });
    if (existing) return existing;
    return tx.shipmentGroup.create({ data: { orderId: orderPk } });
  }

  // ── Order Manager: reserve one physical piece for one unit of an order line ─
  async reserve(orderId: string, dto: ReservePieceDto, adminId: number, actorRole?: UserRole) {
    const order = await this.resolveOrderByOrderId(orderId);

    const orderItem = order.items.find((i) => i.id === dto.orderItemId);
    if (!orderItem) {
      throw new NotFoundException(
        `Order line #${dto.orderItemId} not found on order ${orderId}`,
      );
    }

    const piece = await this.prisma.piece.findUnique({
      where: { id: dto.pieceId },
    });
    if (!piece) {
      throw new NotFoundException(`Piece #${dto.pieceId} not found`);
    }
    if (piece.productSizeId !== orderItem.productSizeId) {
      throw new BadRequestException(
        'This barcode is a different product variant than the order line',
      );
    }

    const existingReservationCount = await this.prisma.orderLineReservation.count({
      where: { orderItemId: dto.orderItemId },
    });
    if (existingReservationCount >= orderItem.quantity) {
      throw new BadRequestException(
        `Order line #${dto.orderItemId} already has all ${orderItem.quantity} unit(s) reserved`,
      );
    }

    const reservation = await this.prisma.$transaction(async (tx) => {
      const shipmentGroup = await this.getOrCreateShipmentGroup(tx, order.id);

      // A piece that came back from a return and was marked Good is just as
      // sellable as a freshly-received one — both count toward
      // ProductSize.quantity via StockLedgerService, so both must be
      // reservable, not just IN_STOCK.
      const claimed = await tx.piece.updateMany({
        where: {
          id: dto.pieceId,
          status: { in: [PieceStatus.IN_STOCK, PieceStatus.RETURNED_IN_STOCK] },
        },
        data: { status: PieceStatus.RESERVED },
      });
      if (claimed.count === 0) {
        throw new BadRequestException(
          `Barcode ${piece.barcodeValue} is no longer available — it may have just been reserved by someone else`,
        );
      }

      await tx.pieceStatusEvent.create({
        data: {
          pieceId: piece.id,
          fromStatus: piece.status,
          toStatus: PieceStatus.RESERVED,
          actorUserId: adminId,
          actorRole,
          source: 'ACTION',
          note: `Reserved for order ${orderId}`,
        },
      });

      return tx.orderLineReservation.create({
        data: {
          orderItemId: dto.orderItemId,
          pieceId: dto.pieceId,
          shipmentGroupId: shipmentGroup.id,
          reservedByUserId: adminId,
        },
        include: RESERVATION_INCLUDE,
      });
    });

    await this.activityLogService.log({
      adminId,
      action: 'RESERVE_PIECE',
      module: 'ORDER',
      targetId: reservation.id,
      targetLabel: `${piece.barcodeValue} → order ${orderId}`,
    });

    return reservation;
  }

  // ── Order Manager: undo a reservation before it's picked ───────────────────
  async release(reservationId: number, adminId: number) {
    const reservation = await this.prisma.orderLineReservation.findUnique({
      where: { id: reservationId },
      include: { piece: true },
    });
    if (!reservation) {
      throw new NotFoundException(`Reservation #${reservationId} not found`);
    }
    if (reservation.pickedAt) {
      throw new BadRequestException(
        'This piece has already been picked — cannot release it here',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.piece.updateMany({
        where: { id: reservation.pieceId, status: PieceStatus.RESERVED },
        data: { status: PieceStatus.IN_STOCK },
      });

      await tx.pieceStatusEvent.create({
        data: {
          pieceId: reservation.pieceId,
          fromStatus: PieceStatus.RESERVED,
          toStatus: PieceStatus.IN_STOCK,
          actorUserId: adminId,
          source: 'ACTION',
          note: 'Reservation released',
        },
      });

      await tx.orderLineReservation.delete({ where: { id: reservationId } });
    });

    return { released: true };
  }

  // ── Called from OrderService.updateOrderStatus when an order is cancelled/failed —
  // frees any reserved/picked pieces back to IN_STOCK inside the SAME transaction. ─
  async releaseReservationsForOrder(tx: Prisma.TransactionClient, orderPk: number) {
    const shipmentGroup = await tx.shipmentGroup.findUnique({
      where: { orderId: orderPk },
      include: { reservations: { include: { piece: true } } },
    });
    if (!shipmentGroup) return;

    for (const reservation of shipmentGroup.reservations) {
      if (
        reservation.piece.status !== PieceStatus.RESERVED &&
        reservation.piece.status !== PieceStatus.PICKED
      ) {
        continue;
      }

      await tx.piece.update({
        where: { id: reservation.pieceId },
        data: { status: PieceStatus.IN_STOCK },
      });

      await tx.pieceStatusEvent.create({
        data: {
          pieceId: reservation.pieceId,
          fromStatus: reservation.piece.status,
          toStatus: PieceStatus.IN_STOCK,
          source: 'SYSTEM',
          note: 'Released — order cancelled/failed',
        },
      });

      await tx.orderLineReservation.delete({ where: { id: reservation.id } });
    }
  }

  // ── Pick slip: what to physically pull off the shelf for this order ────────
  async getPickSlip(orderId: string) {
    const order = await this.resolveOrderByOrderId(orderId);
    const shipmentGroup = await this.prisma.shipmentGroup.findUnique({
      where: { orderId: order.id },
      include: { reservations: { include: RESERVATION_INCLUDE } },
    });

    return {
      orderId: order.orderId,
      shipmentGroupId: shipmentGroup?.id ?? null,
      lines: (shipmentGroup?.reservations ?? []).map((r) => ({
        reservationId: r.id,
        orderItemId: r.orderItemId,
        barcodeValue: r.piece.barcodeValue,
        productTitle: r.piece.productSize.color.product.title,
        color: r.piece.productSize.color.color.name,
        size: r.piece.productSize.size.name,
        locationCode: r.piece.location?.code ?? null,
        pickedAt: r.pickedAt,
      })),
    };
  }

  async emailPickSlip(orderId: string, email: string) {
    const slip = await this.getPickSlip(orderId);
    await this.notificationsService.sendPickSlip(email, slip.orderId, slip.lines);
    return { sent: true };
  }

  // ── Server-computed gate: has every piece-tracked unit on this order been
  // reserved AND picked? Legacy (non-piece-tracked) lines don't count toward
  // this — they were never eligible for reservation in the first place. ─────
  async checkFullyPickedForOrder(
    orderPk: number,
    tx?: Prisma.TransactionClient,
  ): Promise<ShipmentGroupGateResult> {
    const db = tx ?? this.prisma;

    const order = await db.order.findUnique({
      where: { id: orderPk },
      include: { items: { include: { productSize: true } } },
    });
    if (!order) throw new NotFoundException(`Order #${orderPk} not found`);

    const requiredCount = order.items
      .filter((i) => i.productSize?.trackingMode === 'PIECE_BARCODE')
      .reduce((sum, i) => sum + i.quantity, 0);

    if (requiredCount === 0) {
      // No piece-tracked lines on this order — the piece gate doesn't apply.
      return { requiredCount: 0, reservedCount: 0, pickedCount: 0, isFullyPicked: true };
    }

    const shipmentGroup = await db.shipmentGroup.findUnique({
      where: { orderId: orderPk },
      include: { reservations: true },
    });
    const reservations = shipmentGroup?.reservations ?? [];
    const pickedCount = reservations.filter((r) => r.pickedAt).length;

    return {
      requiredCount,
      reservedCount: reservations.length,
      pickedCount,
      isFullyPicked:
        reservations.length === requiredCount && pickedCount === requiredCount,
    };
  }

  async getShipmentGroupStatus(orderId: string) {
    const order = await this.resolveOrderByOrderId(orderId);
    const gate = await this.checkFullyPickedForOrder(order.id);
    const shipmentGroup = await this.prisma.shipmentGroup.findUnique({
      where: { orderId: order.id },
    });
    return { shipmentGroup, ...gate };
  }

  // ── Order Manager: scan-confirm a physically-pulled piece ──────────────────
  async pickConfirm(barcodeValue: string, shipmentGroupId: number, adminId: number, actorRole?: UserRole) {
    const piece = await this.prisma.piece.findUnique({ where: { barcodeValue } });
    if (!piece) {
      throw new NotFoundException(`No piece found for barcode ${barcodeValue}`);
    }

    // A piece can carry many historical reservation rows (one per past sale
    // cycle) — the currently-active one is the single row still awaiting
    // pick (pickedAt: null); Piece.status === RESERVED guarantees at most
    // one such row exists per piece at any given time.
    const activeReservation = await this.prisma.orderLineReservation.findFirst({
      where: { pieceId: piece.id, pickedAt: null },
      orderBy: { reservedAt: 'desc' },
    });
    if (!activeReservation || activeReservation.shipmentGroupId !== shipmentGroupId) {
      throw new BadRequestException(
        `Barcode ${barcodeValue} is not reserved for this shipment group`,
      );
    }
    if (piece.status !== PieceStatus.RESERVED) {
      throw new BadRequestException(
        `Barcode ${barcodeValue} is not awaiting pick (current status: ${piece.status})`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.piece.updateMany({
        where: { id: piece.id, status: PieceStatus.RESERVED },
        data: { status: PieceStatus.PICKED },
      });
      if (updated.count === 0) {
        throw new BadRequestException(
          `Barcode ${barcodeValue} was already picked by another request`,
        );
      }

      await tx.pieceStatusEvent.create({
        data: {
          pieceId: piece.id,
          fromStatus: PieceStatus.RESERVED,
          toStatus: PieceStatus.PICKED,
          actorUserId: adminId,
          actorRole,
          source: 'SCAN',
        },
      });

      await tx.orderLineReservation.update({
        where: { id: activeReservation.id },
        data: { pickedAt: new Date(), pickedByUserId: adminId },
      });
    });

    return this.prisma.piece.findUnique({ where: { id: piece.id } });
  }

  // ── Called from CourierService.createShipment after a shipment is booked —
  // no-op for orders with no piece-tracked lines. ────────────────────────────
  async markShipmentGroupShipped(
    tx: Prisma.TransactionClient,
    orderPk: number,
    courierShipmentId: number,
  ) {
    const shipmentGroup = await tx.shipmentGroup.findUnique({
      where: { orderId: orderPk },
      include: { reservations: true },
    });
    if (!shipmentGroup) return;

    for (const reservation of shipmentGroup.reservations) {
      await tx.piece.update({
        where: { id: reservation.pieceId },
        data: { status: PieceStatus.SHIPPED },
      });

      await tx.pieceStatusEvent.create({
        data: {
          pieceId: reservation.pieceId,
          fromStatus: PieceStatus.PICKED,
          toStatus: PieceStatus.SHIPPED,
          source: 'SYSTEM',
          note: `Courier shipment #${courierShipmentId} booked`,
        },
      });
    }

    await tx.shipmentGroup.update({
      where: { id: shipmentGroup.id },
      data: { status: ShipmentGroupStatus.SHIPPED, courierShipmentId },
    });
  }

  // ── Called from the Pathao webhook cascade (CourierWebhookService) when a
  // shipment reaches a terminal Delivered state. Idempotent: only touches
  // pieces still sitting at SHIPPED, so replaying the same webhook event is
  // a safe no-op. No transaction wrapper — matches the surrounding webhook
  // handler's existing non-transactional, replay-tolerant style. ───────────
  async markShipmentGroupDelivered(orderPk: number) {
    const shipmentGroup = await this.prisma.shipmentGroup.findUnique({
      where: { orderId: orderPk },
      include: { reservations: { include: { piece: true } } },
    });
    if (!shipmentGroup) return;

    for (const reservation of shipmentGroup.reservations) {
      if (reservation.piece.status !== PieceStatus.SHIPPED) continue;

      await this.prisma.piece.update({
        where: { id: reservation.pieceId },
        data: { status: PieceStatus.DELIVERED },
      });

      await this.prisma.pieceStatusEvent.create({
        data: {
          pieceId: reservation.pieceId,
          fromStatus: PieceStatus.SHIPPED,
          toStatus: PieceStatus.DELIVERED,
          source: 'WEBHOOK',
        },
      });
    }
  }

  // ── Called from the Pathao webhook cascade when a shipment is coming back
  // (wrong address / customer refused / damaged / etc — Pathao's raw event
  // string is stored as-is in reasonCode since this codebase doesn't yet
  // have a structured reason-code mapping table for couriers). Moves pieces
  // to RETURNING — actually restocking them requires a physical scan by an
  // Inventory Manager (see Phase 4), this only marks them as in-transit back.
  async markShipmentGroupReturning(orderPk: number, reasonCode?: string) {
    const shipmentGroup = await this.prisma.shipmentGroup.findUnique({
      where: { orderId: orderPk },
      include: {
        reservations: { include: { piece: true } },
        order: { select: { orderId: true } },
      },
    });
    if (!shipmentGroup) return;

    let returnedCount = 0;
    for (const reservation of shipmentGroup.reservations) {
      const fromStatus = reservation.piece.status;
      if (fromStatus !== PieceStatus.SHIPPED && fromStatus !== PieceStatus.DELIVERED) {
        continue;
      }

      await this.prisma.piece.update({
        where: { id: reservation.pieceId },
        data: { status: PieceStatus.RETURNING },
      });

      await this.prisma.pieceStatusEvent.create({
        data: {
          pieceId: reservation.pieceId,
          fromStatus,
          toStatus: PieceStatus.RETURNING,
          source: 'WEBHOOK',
          reasonCode,
        },
      });

      returnedCount++;
    }

    if (returnedCount > 0) {
      this.stockEventsGateway.emitReturnStarted({
        orderId: shipmentGroup.order.orderId,
        pieceCount: returnedCount,
        reasonCode,
      });
    }
  }
}
