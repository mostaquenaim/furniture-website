/*
  Warnings:

  - Added the required column `previousOrderStatus` to the `ReturnRequest` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ReturnRequest" ADD COLUMN     "previousOrderStatus" "OrderStatus" NOT NULL;
