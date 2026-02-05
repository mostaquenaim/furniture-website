/*
  Warnings:

  - You are about to drop the column `price` on the `OrderItem` table. All the data in the column will be lost.
  - Added the required column `basePriceAtPurchase` to the `OrderItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `priceAtPurchase` to the `OrderItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalPriceAtPurchase` to the `OrderItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "districtName" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" DROP COLUMN "price",
ADD COLUMN     "basePriceAtPurchase" INTEGER NOT NULL,
ADD COLUMN     "priceAtPurchase" INTEGER NOT NULL,
ADD COLUMN     "totalPriceAtPurchase" INTEGER NOT NULL;
