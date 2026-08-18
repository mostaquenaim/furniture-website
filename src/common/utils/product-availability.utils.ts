import { Prisma } from '@prisma/client';

// The single real-time-correct check for "is this size sellable right now."
// ProductSize.quantity is always kept in sync by StockLedgerService
// regardless of tracking mode (LEGACY_QUANTITY or PIECE_BARCODE), so no join
// to Piece/OrderLineReservation is needed here.
export const IN_STOCK_SIZE_WHERE: Prisma.ProductSizeWhereInput = {
  quantity: { gt: 0 },
  size: { isActive: true },
};

// Product.totalProductQuantity is a denormalized rollup kept in sync in the
// same transaction as any ProductSize.quantity change — safe fast product-
// level check without joining sizes.
export const IN_STOCK_PRODUCT_WHERE: Prisma.ProductWhereInput = {
  totalProductQuantity: { gt: 0 },
};

/**
 * Drops any color left with zero purchasable sizes after size-level
 * filtering, so a customer never sees a color swatch with nothing to select.
 */
export function filterAvailableColors<T extends { sizes?: unknown[] | null }>(
  colors: T[],
): T[] {
  return colors.filter((c) => c.sizes && c.sizes.length > 0);
}
