/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { BadRequestException } from '@nestjs/common';

const NEW_BADGE_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

export function sanitizeDiscount(product: any): any {
  if (!product) return product;

  // Compute isNew badge — true for 60 days after createdAt, then false automatically.
  const isNew = product.createdAt
    ? Date.now() - new Date(product.createdAt).getTime() <= NEW_BADGE_MS
    : false;

  const normalized = { ...product, isNew };

  if (!normalized.discount) return normalized;

  const start = normalized.discountStart
    ? new Date(normalized.discountStart)
    : null;
  const end = normalized.discountEnd ? new Date(normalized.discountEnd) : null;

  // No window set on either side → the discount has no expiry, always active.
  if (!start && !end) return normalized;

  // A window is only enforced once both ends are set — see
  // assertValidDiscountWindow, which rejects a half-set window at write time.
  const now = new Date();
  if (start && end && (start > now || end < now)) {
    return {
      ...normalized,
      discount: 0,
      discountType: null,
      price: normalized.basePrice,
    };
  }

  return normalized;
}

/**
 * Guards against a discount window that's half-set (only discountStart or
 * only discountEnd) or inverted — both of which used to be silently created
 * as an already-expired, same-instant window because the schema defaulted
 * both dates to `now()`. Call before creating/updating a Product.
 */
export function assertValidDiscountWindow(
  discountStart?: Date | string | null,
  discountEnd?: Date | string | null,
): void {
  const hasStart = discountStart !== undefined && discountStart !== null;
  const hasEnd = discountEnd !== undefined && discountEnd !== null;

  if (hasStart !== hasEnd) {
    throw new BadRequestException(
      'discountStart and discountEnd must be provided together, or both left empty for a discount with no expiry',
    );
  }

  if (hasStart && hasEnd && new Date(discountEnd) <= new Date(discountStart)) {
    throw new BadRequestException('discountEnd must be after discountStart');
  }
}
