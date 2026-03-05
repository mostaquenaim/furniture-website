/*
  Warnings:

  - You are about to drop the column `productId` on the `InventoryItem` table. All the data in the column will be lost.
  - Added the required column `productSizeId` to the `InventoryItem` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "InventoryItem" DROP CONSTRAINT "InventoryItem_productId_fkey";

-- AlterTable
ALTER TABLE "InventoryItem" DROP COLUMN "productId",
ADD COLUMN     "productSizeId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_productSizeId_fkey" FOREIGN KEY ("productSizeId") REFERENCES "ProductSize"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
