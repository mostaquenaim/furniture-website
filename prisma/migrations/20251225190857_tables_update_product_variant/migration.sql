/*
  Warnings:

  - You are about to drop the column `isActive` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `ProductSize` table. All the data in the column will be lost.
  - Added the required column `sizeId` to the `ProductSize` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Product" DROP COLUMN "isActive",
ADD COLUMN     "hasColorVariants" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "ProductSize" DROP COLUMN "name",
ADD COLUMN     "sizeId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "ProductSize" ADD CONSTRAINT "ProductSize_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "Size"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
