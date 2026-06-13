/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
export function sanitizeDiscount(product: any): any {
  if (!product || !product.discount) return product;
  const now = new Date();
  const start = product.discountStart ? new Date(product.discountStart) : null;
  const end = product.discountEnd ? new Date(product.discountEnd) : null;
  if (!start || !end || start > now || end < now) {
    return {
      ...product,
      discount: 0,
      discountType: null,
      price: product.basePrice,
    };
  }

  return product;
}
