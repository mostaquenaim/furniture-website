import { BadRequestException } from '@nestjs/common';

// Product columns the listing endpoints (/product/all, /product/on-sale,
// /series/:slug/products, /subcategory/:slug/products) may sort by.
// "featured" is the storefront's sort key for isFeatured.
const SORTABLE_PRODUCT_FIELDS: Record<string, string> = {
  sortOrder: 'sortOrder',
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
};

/**
 * Resolves sortBy/order query values to a Prisma Product orderBy. No sortBy
 * → undefined (the caller's default order). Unknown values are a 400 rather
 * than reaching Prisma, which throws a 500 for them.
 */
export function resolveProductOrderBy(
  sortBy: unknown,
  order: unknown,
): Record<string, 'asc' | 'desc'> | undefined {
  if (sortBy === undefined || sortBy === '') return undefined;
  if (order !== 'asc' && order !== 'desc') {
    throw new BadRequestException('order must be "asc" or "desc"');
  }
  const field =
    typeof sortBy === 'string' &&
    Object.prototype.hasOwnProperty.call(SORTABLE_PRODUCT_FIELDS, sortBy)
      ? SORTABLE_PRODUCT_FIELDS[sortBy]
      : undefined;
  if (!field) {
    throw new BadRequestException(
      typeof sortBy === 'string'
        ? `Cannot sort products by "${sortBy}"`
        : 'sortBy must be a single value',
    );
  }
  return { [field]: order };
}
