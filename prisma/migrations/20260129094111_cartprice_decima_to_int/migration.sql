/*
  Warnings:

  - You are about to alter the column `priceAtAdd` on the `CartItem` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Integer`.
  - You are about to alter the column `basePriceAtAdd` on the `CartItem` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Integer`.
  - You are about to alter the column `baseSubtotalAtAdd` on the `CartItem` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Integer`.
  - You are about to alter the column `subtotalAtAdd` on the `CartItem` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Integer`.

*/
-- AlterTable
ALTER TABLE "CartItem" ALTER COLUMN "priceAtAdd" SET DATA TYPE INTEGER,
ALTER COLUMN "basePriceAtAdd" SET DATA TYPE INTEGER,
ALTER COLUMN "baseSubtotalAtAdd" SET DATA TYPE INTEGER,
ALTER COLUMN "subtotalAtAdd" SET DATA TYPE INTEGER;
