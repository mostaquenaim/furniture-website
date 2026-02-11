/*
  Warnings:

  - You are about to drop the column `featured` on the `Product` table. All the data in the column will be lost.
  - The `discountType` column on the `Product` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Product" DROP COLUMN "featured",
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false,
DROP COLUMN "discountType",
ADD COLUMN     "discountType" "CouponDiscountType";
