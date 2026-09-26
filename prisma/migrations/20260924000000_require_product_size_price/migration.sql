-- Backfill variants saved without a price, then make price mandatory.
-- Mirrors ProductService.createSizeWithPieces: a size with no price of its
-- own inherits the product's basePrice, then its own discount is applied.

-- 1. basePrice falls back to the parent product's basePrice.
UPDATE "ProductSize" ps
SET "basePrice" = p."basePrice"
FROM "ProductColor" pc
JOIN "Product" p ON p."id" = pc."productId"
WHERE ps."colorId" = pc."id"
  AND ps."basePrice" IS NULL;

-- 2. price is derived from basePrice and the size's own discount.
UPDATE "ProductSize"
SET "price" = GREATEST(
  0,
  CASE
    WHEN "discount" > 0 AND "discountType" = 'PERCENT'
      THEN ROUND("basePrice" - ("basePrice" * "discount") / 100.0)::int
    WHEN "discount" > 0 AND "discountType" = 'FIXED'
      THEN "basePrice" - "discount"
    ELSE "basePrice"
  END
)
WHERE "price" IS NULL;

-- 3. Enforce it going forward.
ALTER TABLE "ProductSize" ALTER COLUMN "basePrice" SET NOT NULL,
ALTER COLUMN "price" SET NOT NULL;
