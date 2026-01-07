/*
  Warnings:

  - You are about to drop the column `productId` on the `BlogPost` table. All the data in the column will be lost.
  - Added the required column `subCategoryId` to the `BlogPost` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "BlogPost" DROP CONSTRAINT "BlogPost_productId_fkey";

-- AlterTable
ALTER TABLE "BlogPost" DROP COLUMN "productId",
ADD COLUMN     "subCategoryId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_subCategoryId_fkey" FOREIGN KEY ("subCategoryId") REFERENCES "SubCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
