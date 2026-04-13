/*
  Warnings:

  - You are about to drop the column `type` on the `HomepageGallery` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "HomepageGallery" DROP COLUMN "type",
ADD COLUMN     "isHeading" BOOLEAN NOT NULL DEFAULT false;

-- DropEnum
DROP TYPE "GalleryItemType";
