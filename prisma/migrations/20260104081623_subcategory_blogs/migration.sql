/*
  Warnings:

  - You are about to drop the column `subCategoryId` on the `BlogPost` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "BlogPost" DROP CONSTRAINT "BlogPost_subCategoryId_fkey";

-- AlterTable
ALTER TABLE "BlogPost" DROP COLUMN "subCategoryId";

-- CreateTable
CREATE TABLE "SubCategoryBlogs" (
    "subCategoryId" INTEGER NOT NULL,
    "blogPostId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubCategoryBlogs_pkey" PRIMARY KEY ("subCategoryId","blogPostId")
);

-- AddForeignKey
ALTER TABLE "SubCategoryBlogs" ADD CONSTRAINT "SubCategoryBlogs_subCategoryId_fkey" FOREIGN KEY ("subCategoryId") REFERENCES "SubCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubCategoryBlogs" ADD CONSTRAINT "SubCategoryBlogs_blogPostId_fkey" FOREIGN KEY ("blogPostId") REFERENCES "BlogPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
