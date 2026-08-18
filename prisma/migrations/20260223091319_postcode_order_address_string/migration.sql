/*
  Warnings:

  - You are about to drop the column `postcode` on the `Order` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Order" DROP COLUMN "postcode",
ADD COLUMN     "postCode" TEXT;
