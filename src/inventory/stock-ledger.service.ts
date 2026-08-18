import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, StockAdjustReason } from '@prisma/client';

export interface RecordAdjustmentParams {
  productSizeId: number;
  productId: number;
  /** Negative = decrement, positive = increment. */
  delta: number;
  reason: StockAdjustReason;
  note?: string;
  adminId?: number;
  /** Used only to build a friendly insufficient-stock error message. */
  productLabel?: string;
}

export interface RecordAdjustmentResult {
  quantityAfter: number;
  lowStockAt: number;
}

/**
 * Single chokepoint for every mutation of sellable stock (ProductSize.quantity /
 * Product.totalProductQuantity). Order placement, order cancellation/return restores,
 * and manual admin corrections all go through this — each call both moves the
 * quantity (with the same oversell guard order.service.ts already used) and writes
 * an auditable StockAdjustment row.
 *
 * Always called with the CALLER's transaction client — this service never opens its
 * own Prisma instance or nested transaction, so it can be safely composed inside
 * createOrder / updateOrderStatus / InventoryService.adjustStock's existing $transaction.
 */
@Injectable()
export class StockLedgerService {
  async recordAdjustment(
    tx: Prisma.TransactionClient,
    params: RecordAdjustmentParams,
  ): Promise<RecordAdjustmentResult> {
    const {
      productSizeId,
      productId,
      delta,
      reason,
      note,
      adminId,
      productLabel,
    } = params;

    if (delta === 0) {
      throw new BadRequestException('Stock adjustment delta cannot be zero');
    }

    // Same gte-oversell-guard pattern as order.service.ts:288 — only matters when
    // delta is negative (decrementing); for increments (restocks/restores) the
    // guard condition (quantity >= -delta, i.e. >= a non-positive number) always
    // passes, so this single updateMany handles both directions.
    const updated = await tx.productSize.updateMany({
      where: {
        id: productSizeId,
        quantity: { gte: -delta },
      },
      data: {
        quantity: { increment: delta },
      },
    });

    if (updated.count === 0) {
      throw new BadRequestException(
        `Insufficient stock${productLabel ? ` for ${productLabel}` : ''}`,
      );
    }

    const productSize = await tx.productSize.findUniqueOrThrow({
      where: { id: productSizeId },
      select: { quantity: true, lowStockAt: true },
    });

    await tx.product.update({
      where: { id: productId },
      data: {
        totalProductQuantity: { increment: delta },
      },
    });

    await tx.stockAdjustment.create({
      data: {
        productSizeId,
        productId,
        delta,
        quantityAfter: productSize.quantity,
        reason,
        note,
        adminId,
      },
    });

    return {
      quantityAfter: productSize.quantity,
      lowStockAt: productSize.lowStockAt,
    };
  }
}
