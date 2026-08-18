/*
  Warnings:

  - You are about to drop the column `subtotal` on the `CartItem` table. All the data in the column will be lost.
  - You are about to alter the column `priceAtAdd` on the `CartItem` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - Added the required column `subtotalAtAdd` to the `CartItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `CartItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CartItem" DROP COLUMN "subtotal",
ADD COLUMN     "basePriceAtAdd" DECIMAL(65,30),
ADD COLUMN     "baseSubtotalAtAdd" DECIMAL(65,30),
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "subtotalAtAdd" DECIMAL(65,30) NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "priceAtAdd" SET DATA TYPE DECIMAL(65,30);
