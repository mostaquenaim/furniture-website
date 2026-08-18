/*
  Warnings:

  - You are about to drop the column `bin` on the `InventoryItem` table. All the data in the column will be lost.
  - You are about to drop the column `rack` on the `InventoryItem` table. All the data in the column will be lost.
  - You are about to drop the column `warehouse` on the `InventoryItem` table. All the data in the column will be lost.
  - Added the required column `productId` to the `InventoryItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `InventoryItem` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "BarcodeType" AS ENUM ('CODE128', 'QR', 'EAN13');

-- DropForeignKey
ALTER TABLE "InventoryItem" DROP CONSTRAINT "InventoryItem_productSizeId_fkey";

-- AlterTable
ALTER TABLE "InventoryItem" DROP COLUMN "bin",
DROP COLUMN "rack",
DROP COLUMN "warehouse",
ADD COLUMN     "lastCountedAt" TIMESTAMP(3),
ADD COLUMN     "locationId" TEXT,
ADD COLUMN     "lowStockAt" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "printCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "printedAt" TIMESTAMP(3),
ADD COLUMN     "productId" INTEGER NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "productSizeId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "WarehouseLocation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "aisle" TEXT NOT NULL,
    "shelf" TEXT NOT NULL,
    "bin" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseLocation_code_key" ON "WarehouseLocation"("code");

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_productSizeId_fkey" FOREIGN KEY ("productSizeId") REFERENCES "ProductSize"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "WarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
