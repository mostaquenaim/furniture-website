import { Prisma } from '@prisma/client';
import { ParsedSort } from 'src/common/utils/sort.utils';

// Public ?sortBy keys accepted by GET /product/all → Product columns.
// Storefront sort menu: price, createdAt, featured, soldCount, rating, title,
// trendScore. Admin table: createdAt, title, slug, basePrice, isActive.
export const PRODUCT_SORT_FIELDS = {
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  title: 'title',
  slug: 'slug',
  basePrice: 'basePrice',
  price: 'price',
  isActive: 'isActive',
  isFeatured: 'isFeatured',
  featured: 'isFeatured',
  soldCount: 'soldCount',
  rating: 'rating',
  trendScore: 'trendScore',
  viewCount: 'viewCount',
  sortOrder: 'sortOrder',
} as const satisfies Record<
  string,
  keyof Prisma.ProductOrderByWithRelationInput
>;

export type ProductSortField =
  (typeof PRODUCT_SORT_FIELDS)[keyof typeof PRODUCT_SORT_FIELDS];

// Always ends with id so rows that tie on the chosen column (every product
// starts at sortOrder 0, isActive splits into two big groups) keep a fixed
// order — otherwise Postgres can return them differently per page and the
// paginated list skips or repeats products.
export function buildProductOrderBy(
  sort: ParsedSort<ProductSortField> | undefined,
): Prisma.ProductOrderByWithRelationInput[] {
  if (!sort) return [{ sortOrder: 'asc' }, { id: 'desc' }];

  const { field, direction } = sort;

  // price is the only nullable sort column — keep unpriced rows at the end
  // in both directions instead of Postgres' default of NULLs first on desc
  const primary: Prisma.ProductOrderByWithRelationInput =
    field === 'price'
      ? { price: { sort: direction, nulls: 'last' } }
      : { [field]: direction };

  return [primary, { id: direction }];
}
