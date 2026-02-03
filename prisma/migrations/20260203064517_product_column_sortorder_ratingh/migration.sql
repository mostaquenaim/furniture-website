/*
  Warnings:

  - You are about to alter the column `rating` on the `Product` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(3,2)`.

*/
-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "rating" SET DATA TYPE DECIMAL(3,2);
