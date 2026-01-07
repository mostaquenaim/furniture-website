/*
  Warnings:

  - You are about to drop the column `productId` on the `CartItem` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId]` on the table `Cart` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[cartId,productSizeId]` on the table `CartItem` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `priceAtAdd` to the `CartItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productSizeId` to the `CartItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subtotal` to the `CartItem` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'CHECKED_OUT', 'ABANDONED');

-- DropForeignKey
ALTER TABLE "CartItem" DROP CONSTRAINT "CartItem_productId_fkey";

-- AlterTable
ALTER TABLE "Cart" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "CartItem" DROP COLUMN "productId",
ADD COLUMN     "priceAtAdd" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "productSizeId" INTEGER NOT NULL,
ADD COLUMN     "subtotal" DOUBLE PRECISION NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Cart_userId_key" ON "Cart"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_productSizeId_key" ON "CartItem"("cartId", "productSizeId");

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productSizeId_fkey" FOREIGN KEY ("productSizeId") REFERENCES "ProductSize"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
