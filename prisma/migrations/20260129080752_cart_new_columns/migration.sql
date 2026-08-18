/*
  Warnings:

  - Made the column `basePriceAtAdd` on table `CartItem` required. This step will fail if there are existing NULL values in that column.
  - Made the column `baseSubtotalAtAdd` on table `CartItem` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "CartItem" ALTER COLUMN "basePriceAtAdd" SET NOT NULL,
ALTER COLUMN "baseSubtotalAtAdd" SET NOT NULL;
