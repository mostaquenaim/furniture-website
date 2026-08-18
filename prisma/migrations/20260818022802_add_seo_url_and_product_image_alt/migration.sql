-- AlterTable
ALTER TABLE "SEO" ADD COLUMN "url" TEXT NOT NULL,
ADD COLUMN "updatedBy" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "SEO_url_key" ON "SEO"("url");

-- AlterTable
ALTER TABLE "ProductImage" ADD COLUMN "alt" TEXT;
