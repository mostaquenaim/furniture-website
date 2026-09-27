/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { BadRequestException } from '@nestjs/common';
import { IN_STOCK_SIZE_WHERE } from './product-availability.utils';

const NEW_BADGE_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

/**
 * The size fields sanitizeDiscount needs to derive a listing price. Spread
 * into a Product query's `colors` include/select wherever a price is shown:
 *   colors: { select: { sizes: DISPLAY_SIZES } }
 *   colors: { include: { color: true, sizes: DISPLAY_SIZES } }
 */
export const DISPLAY_SIZES = {
  where: IN_STOCK_SIZE_WHERE,
  select: { basePrice: true, price: true, discount: true, discountType: true },
} as const;

/**
 * Single source of truth for product/size discount pricing.
 *
 * ProductSize is authoritative: its basePrice/discount/price are what the
 * customer sees and pays. Product.basePrice/discount/discountType are only
 * the defaults the admin form pre-fills into each size.
 *
 * The product's discountStart/discountEnd window switches every size's
 * discount on/off: outside the window each size is charged its basePrice.
 * A product with no window (both null) has its size discounts always on.
 *
 * Product.price is a derived column — the cheapest size's effective price
 * right now — kept only so the DB can filter/sort by price. It's re-synced on
 * every product write and by a minutely cron when a window opens/closes.
 *
 * Every place that shows or charges a price goes through these helpers so
 * listings, product page, cart and order can never disagree.
 */

type DiscountWindow = {
  discountStart?: Date | string | null;
  discountEnd?: Date | string | null;
};

type DiscountFields = {
  discount?: number | null;
  discountType?: string | null;
};

export function isDiscountWindowOpen(
  product: DiscountWindow,
  now: Date = new Date(),
): boolean {
  const start = product.discountStart ? new Date(product.discountStart) : null;
  const end = product.discountEnd ? new Date(product.discountEnd) : null;
  // A half-set window is rejected at write time (assertValidDiscountWindow),
  // so "not both set" means no window → discount always on.
  if (!start || !end) return true;
  return start <= now && now <= end;
}

/** basePrice with the discount applied, clamped at 0. Ignores any window. */
export function applyDiscount(
  basePrice: number,
  discount?: number | null,
  discountType?: string | null,
): number {
  if (!discount || discount <= 0 || !discountType) return basePrice;

  let price = basePrice;
  if (discountType === 'PERCENT') {
    price = Math.round(basePrice - (basePrice * discount) / 100);
  } else if (discountType === 'FIXED') {
    price = basePrice - discount;
  }
  return Math.max(0, price);
}

type SizePricing = DiscountFields & { basePrice: number; price: number };

export type DisplayPricing = {
  basePrice: number;
  price: number;
  discount: number;
  discountType: string | null;
};

/**
 * What a listing card shows: the cheapest size's effective price right now,
 * paired with that size's own basePrice/discount (so the strike-through and
 * "% OFF" badge describe the same size). Falls back to the product-level
 * defaults only when the product has no sizes at all.
 */
export function computeDisplayPricing(
  product: DiscountWindow &
    DiscountFields & {
      basePrice: number;
      colors?: { sizes?: SizePricing[] | null }[] | null;
    },
  now: Date = new Date(),
): DisplayPricing {
  const open = isDiscountWindowOpen(product, now);
  const sizes = (product.colors ?? []).flatMap((c) => c?.sizes ?? []);

  if (sizes.length === 0) {
    return open
      ? {
          basePrice: product.basePrice,
          price: applyDiscount(
            product.basePrice,
            product.discount,
            product.discountType,
          ),
          discount: product.discount ?? 0,
          discountType: product.discountType ?? null,
        }
      : {
          basePrice: product.basePrice,
          price: product.basePrice,
          discount: 0,
          discountType: null,
        };
  }

  let best: SizePricing = sizes[0];
  let bestPrice = effectiveSizePrice(best, product, now);
  for (const s of sizes.slice(1)) {
    const p = effectiveSizePrice(s, product, now);
    if (p < bestPrice || (p === bestPrice && s.basePrice < best.basePrice)) {
      best = s;
      bestPrice = p;
    }
  }

  return {
    basePrice: best.basePrice,
    price: bestPrice,
    discount: open ? (best.discount ?? 0) : 0,
    discountType: open ? (best.discountType ?? null) : null,
  };
}

/** What a variant is charged right now, honouring the product's window. */
export function effectiveSizePrice(
  size: { basePrice: number; price: number },
  product: DiscountWindow,
  now: Date = new Date(),
): number {
  return isDiscountWindowOpen(product, now) ? size.price : size.basePrice;
}

/**
 * Rejects discounts that would produce a nonsense price: negative values,
 * a discount with no (or an unknown) type, more than 100%, or a fixed amount
 * larger than the price it's taken off. Call for the product and every size
 * before writing.
 */
export function assertValidDiscount(
  basePrice: number,
  discount: number | null | undefined,
  discountType: string | null | undefined,
  label = 'Discount',
): void {
  if (discount === null || discount === undefined || discount === 0) return;

  if (!Number.isFinite(discount) || discount < 0) {
    throw new BadRequestException(`${label} cannot be negative`);
  }
  if (discountType !== 'PERCENT' && discountType !== 'FIXED') {
    throw new BadRequestException(
      `${label} needs a discount type (PERCENT or FIXED)`,
    );
  }
  if (discountType === 'PERCENT' && discount > 100) {
    throw new BadRequestException(`${label} percentage cannot exceed 100%`);
  }
  if (discountType === 'FIXED' && discount > basePrice) {
    throw new BadRequestException(
      `${label} (৳${discount}) cannot exceed the price (৳${basePrice})`,
    );
  }
}

/**
 * Normalises a product for the storefront: top-level basePrice/price/
 * discount/discountType are replaced with the cheapest size's live pricing
 * (see computeDisplayPricing), and — outside the discount window — each
 * included size is reset to its basePrice so the product page matches what
 * checkout charges. Needs colors.sizes (basePrice, price, discount,
 * discountType) included to be accurate; use DISPLAY_SIZES_INCLUDE.
 */
export function sanitizeDiscount(product: any): any {
  if (!product) return product;

  // Compute isNew badge — true for 60 days after createdAt, then false automatically.
  const isNew = product.createdAt
    ? Date.now() - new Date(product.createdAt).getTime() <= NEW_BADGE_MS
    : false;

  const now = new Date();
  const open = isDiscountWindowOpen(product, now);
  const normalized = { ...product, isNew };

  if (typeof normalized.basePrice === 'number') {
    Object.assign(normalized, computeDisplayPricing(normalized, now));
  }

  if (!open && Array.isArray(normalized.colors)) {
    normalized.colors = normalized.colors.map((c: any) =>
      Array.isArray(c?.sizes)
        ? {
            ...c,
            sizes: c.sizes.map((s: any) => ({
              ...s,
              price: s.basePrice,
              discount: 0,
              discountType: null,
            })),
          }
        : c,
    );
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
