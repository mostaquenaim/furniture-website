/*
  Warnings:

  - You are about to drop the column `couponId` on the `Order` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_couponId_fkey";

-- AlterTable
ALTER TABLE "Cart" ADD COLUMN     "couponId" INTEGER;

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "couponId";

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
