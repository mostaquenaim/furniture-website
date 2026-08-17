import { Coupon, CouponDiscountType } from '@prisma/client';

/**
 * Single source of truth for "what does this coupon do to this cart",
 * shared by CartService (live preview while the customer is shopping) and
 * OrderService (the authoritative calculation at order creation). Nothing
 * about the discount is ever persisted on the cart — it's recomputed fresh
 * from the coupon + current item prices/categories every time, so it can
 * never go stale when items are added/removed or a coupon is edited.
 */

export interface CouponEligibilityItem {
  subtotalAtAdd: number;
  categoryIds: number[];
}

export interface CouponWithCategories extends Coupon {
  categories: { categoryId: number }[];
}

export interface CouponDiscountResult {
  /** Sum of subtotals for items the coupon actually applies to. */
  eligibleSubtotal: number;
  /** Amount to subtract from the cart total. Always 0 for FREE_DELIVERY. */
  discountAmount: number;
  /** True if this coupon should zero out the delivery charge. */
  freeDelivery: boolean;
  /** Ids of the items counted in eligibleSubtotal, for reference. */
  eligibleItemIndexes: number[];
}

export function isCouponWithinWindow(
  coupon: Pick<Coupon, 'isActive' | 'startDate' | 'expiryDate'>,
  now: Date = new Date(),
): { ok: true } | { ok: false; reason: string } {
  if (!coupon.isActive) {
    return { ok: false, reason: 'This coupon is no longer active' };
  }
  if (now < coupon.startDate) {
    return { ok: false, reason: 'This coupon is not yet valid' };
  }
  if (now > coupon.expiryDate) {
    return { ok: false, reason: 'This coupon has expired' };
  }
  return { ok: true };
}

// Round to cents so discounts never carry binary-float noise into totals.
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeCouponDiscount(
  items: CouponEligibilityItem[],
  coupon: CouponWithCategories,
): CouponDiscountResult {
  const restrictedCategoryIds = coupon.categories.map((c) => c.categoryId);
  const isRestricted = restrictedCategoryIds.length > 0;

  const eligibleItemIndexes: number[] = [];
  let eligibleSubtotal = 0;

  items.forEach((item, index) => {
    const isEligible =
      !isRestricted ||
      item.categoryIds.some((id) => restrictedCategoryIds.includes(id));

    if (isEligible) {
      eligibleItemIndexes.push(index);
      eligibleSubtotal += item.subtotalAtAdd;
    }
  });

  let discountAmount = 0;
  let freeDelivery = false;

  switch (coupon.discountType) {
    case CouponDiscountType.FIXED_AMOUNT:
      // Never discount more than what the eligible items are actually worth.
      discountAmount = Math.min(coupon.discountValue ?? 0, eligibleSubtotal);
      break;
    case CouponDiscountType.PERCENTAGE:
      discountAmount = Math.min(
        ((coupon.discountValue ?? 0) / 100) * eligibleSubtotal,
        coupon.maxDiscount ?? Infinity,
        eligibleSubtotal,
      );
      break;
    case CouponDiscountType.FREE_DELIVERY:
      freeDelivery = true;
      break;
  }

  return {
    eligibleSubtotal: round2(eligibleSubtotal),
    discountAmount: round2(discountAmount),
    freeDelivery,
    eligibleItemIndexes,
  };
}

/**
 * Validates minOrderValue and (for restricted coupons) that the cart
 * actually contains at least one eligible item. Checked against the
 * eligible-items subtotal, not the whole cart — a category-restricted
 * coupon's minimum spend is a minimum spend on the products it discounts,
 * not an excuse to let unrelated filler items count toward it.
 */
export function validateCouponAgainstCart(
  coupon: CouponWithCategories,
  discount: CouponDiscountResult,
): { ok: true } | { ok: false; reason: string } {
  const isRestricted = coupon.categories.length > 0;

  if (isRestricted && discount.eligibleItemIndexes.length === 0) {
    return {
      ok: false,
      reason: 'Your cart has no items eligible for this coupon',
    };
  }

  if (coupon.minOrderValue && discount.eligibleSubtotal < coupon.minOrderValue) {
    return {
      ok: false,
      reason: `Minimum order value for this coupon is ${coupon.minOrderValue}`,
    };
  }

  return { ok: true };
}
