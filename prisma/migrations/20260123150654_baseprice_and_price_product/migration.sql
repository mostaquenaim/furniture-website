/*
  Warnings:

  - You are about to alter the column `basePrice` on the `Product` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.

*/
-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "price" INTEGER,
ALTER COLUMN "basePrice" SET DATA TYPE INTEGER;
