/*
  Warnings:

  - Added the required column `baseSubtotalAtAdd` to the `Cart` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subtotalAtAdd` to the `Cart` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Cart" ADD COLUMN     "baseSubtotalAtAdd" INTEGER NOT NULL,
ADD COLUMN     "subtotalAtAdd" INTEGER NOT NULL;
