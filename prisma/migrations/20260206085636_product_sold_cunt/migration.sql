/*
  Warnings:

  - You are about to drop the column `sold` on the `Product` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Product" DROP COLUMN "sold",
ADD COLUMN     "soldCount" INTEGER NOT NULL DEFAULT 0;
