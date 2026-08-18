// src/order-status/order-status.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  Order,
  OrderStatus,
  Prisma,
  ProductTrackingMode,
  StockAdjustReason,
} from '@prisma/client';
import { StockLedgerService } from '../inventory/stock-ledger.service';
import { ReservationService } from '../reservation/reservation.service';
import { StockUpdatedPayload } from '../realtime/stock-events.gateway';

export interface ApplyOrderStatusChangeParams {
  orderPk: number;
  newStatus: OrderStatus;
  /** Overrides the auto-generated OrderStatusHistory note. */
  historyNote?: string;
  /** Attributes the StockAdjustment audit row to an admin; omit for system/courier-driven changes. */
  adminId?: number;
  /** Extra Order columns to patch in the same update (e.g. courier's awbNumber). */
  extraOrderData?: Prisma.OrderUpdateInput;
}

export interface ApplyOrderStatusChangeResult {
  order: Order;
  previousStatus: OrderStatus;
  stockRestored: boolean;
  stockEvents: StockUpdatedPayload[];
}

/**
 * Single chokepoint for every Order.status mutation. Admin's manual status
 * dropdown, the courier webhook, and the courier shipment-creation sync all
 * used to write `tx.order.update({ data: { status } })` directly and only
 * one of them (the admin path) remembered to restore stock and release piece
 * reservations for CANCELLED/FAILED/RETURNED. A courier reporting a
 * cancellation/return then flipped Order.status with nobody ever giving the
 * reserved pieces or ProductSize.quantity back — a silent inventory leak.
 * Every caller must route status changes through applyStatusChange instead
 * of updating Order.status directly, so this invariant can't drift again.
 */
@Injectable()
export class OrderStatusService {
  private readonly logger = new Logger(OrderStatusService.name);

  private static readonly STOCK_RESTORE_STATUSES: OrderStatus[] = [
    OrderStatus.CANCELLED,
    OrderStatus.FAILED,
    OrderStatus.RETURNED,
  ];

  constructor(
    private stockLedgerService: StockLedgerService,
    private reservationService: ReservationService,
  ) {}

  async applyStatusChange(
    tx: Prisma.TransactionClient,
    params: ApplyOrderStatusChangeParams,
  ): Promise<ApplyOrderStatusChangeResult> {
    const { orderPk, newStatus, historyNote, adminId, extraOrderData } = params;

    const order = await tx.order.findUnique({
      where: { id: orderPk },
      include: {
        items: { include: { productSize: { select: { trackingMode: true } } } },
      },
    });
    if (!order) {
      throw new NotFoundException(`Order #${orderPk} not found`);
    }

    const previousStatus = order.status;
    const stockEvents: StockUpdatedPayload[] = [];

    const shouldRestoreStock =
      OrderStatusService.STOCK_RESTORE_STATUSES.includes(newStatus) &&
      !OrderStatusService.STOCK_RESTORE_STATUSES.includes(order.status) &&
      !order.stockRestored;

    if (shouldRestoreStock) {
      // Free any piece-level reservations for this order back to IN_STOCK
      // before restoring the aggregate ProductSize.quantity below — a
      // cancelled/failed/returned order must never leave a physical piece
      // permanently locked in RESERVED/PICKED with no order to fulfill.
      await this.reservationService.releaseReservationsForOrder(tx, order.id);

      for (const item of order.items) {
        if (!item.productSizeId) {
          this.logger.warn(
            `Order ${order.orderId} item ${item.id} has no productSizeId snapshot — skipping stock restore for this legacy item`,
          );
          continue;
        }

        if (
          newStatus === OrderStatus.RETURNED &&
          item.productSize?.trackingMode === ProductTrackingMode.PIECE_BARCODE
        ) {
          // Piece-tracked variant — the physical unit left the warehouse when
          // it shipped, so a courier/admin "returned" status is only a claim
          // that it's on its way back, not proof it's arrived. Never restock
          // here; ReservationService.markShipmentGroupReturning already moved
          // the piece to RETURNING, and PieceService.returnReceive (the only
          // path allowed to increment quantity for PIECE_BARCODE — see its
          // comment) does so once staff actually scan it back in. Restoring
          // stock here too would double-count it on top of that scan.
          this.logger.log(
            `Order ${order.orderId} item ${item.id} is piece-tracked — skipping stock restore on RETURNED, awaiting physical scan`,
          );
          continue;
        }

        const result = await this.stockLedgerService.recordAdjustment(tx, {
          productSizeId: item.productSizeId,
          productId: item.productId,
          delta: item.quantity,
          reason:
            newStatus === OrderStatus.RETURNED
              ? StockAdjustReason.ORDER_RETURNED
              : StockAdjustReason.ORDER_CANCELLED,
          adminId,
          note: `Order ${order.orderId} status changed to ${newStatus}`,
        });

        await tx.productSize.update({
          where: { id: item.productSizeId },
          data: { soldCount: { decrement: item.quantity } },
        });

        await tx.product.update({
          where: { id: item.productId },
          data: { soldCount: { decrement: item.quantity } },
        });

        stockEvents.push({
          productSizeId: item.productSizeId,
          productId: item.productId,
          quantity: result.quantityAfter,
          lowStockAt: result.lowStockAt,
        });
      }
    }

    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        status: newStatus,
        ...(shouldRestoreStock && { stockRestored: true }),
        ...extraOrderData,
      },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status: newStatus,
        note:
          historyNote ??
          (shouldRestoreStock
            ? `Order status changed to ${newStatus} — stock restored for ${stockEvents.length} item(s)`
            : `Order status changed to ${newStatus}`),
      },
    });

    return {
      order: updatedOrder,
      previousStatus,
      stockRestored: shouldRestoreStock,
      stockEvents,
    };
  }
}
