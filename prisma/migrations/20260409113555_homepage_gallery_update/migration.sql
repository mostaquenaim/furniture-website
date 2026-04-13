-- CreateEnum
CREATE TYPE "GalleryItemType" AS ENUM ('HEADING', 'REGULAR');

-- AlterTable
ALTER TABLE "HomepageGallery" ADD COLUMN     "type" "GalleryItemType" NOT NULL DEFAULT 'REGULAR';
