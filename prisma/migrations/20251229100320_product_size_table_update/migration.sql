/*
  Warnings:

  - You are about to drop the column `sizeId` on the `ProductStock` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "ProductStock" DROP CONSTRAINT "ProductStock_sizeId_fkey";

-- DropIndex
DROP INDEX "ProductStock_sizeId_key";

-- AlterTable
ALTER TABLE "ProductSize" ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ProductStock" DROP COLUMN "sizeId";
