/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { BadRequestException } from '@nestjs/common';

export function sanitizeDiscount(product: any): any {
  if (!product || !product.discount) return product;

  const start = product.discountStart ? new Date(product.discountStart) : null;
  const end = product.discountEnd ? new Date(product.discountEnd) : null;

  // No window set on either side → the discount has no expiry, always active.
  if (!start && !end) return product;

  // A window is only enforced once both ends are set — see
  // assertValidDiscountWindow, which rejects a half-set window at write time.
  const now = new Date();
  if (start && end && (start > now || end < now)) {
    return {
      ...product,
      discount: 0,
      discountType: null,
      price: product.basePrice,
    };
  }

  return product;
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
