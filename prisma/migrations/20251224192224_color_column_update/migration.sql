-- AlterTable
ALTER TABLE "Color" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "ProductImage" ADD COLUMN     "colorName" TEXT,
ADD COLUMN     "hexCode" TEXT;
