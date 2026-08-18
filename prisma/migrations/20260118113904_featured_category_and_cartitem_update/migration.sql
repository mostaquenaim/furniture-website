-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "color" TEXT,
ADD COLUMN     "size" TEXT;

-- CreateTable
CREATE TABLE "HomepageBanner" (
    "id" SERIAL NOT NULL,
    "image" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomepageBanner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeaturedCategory" (
    "id" SERIAL NOT NULL,
    "image" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "subCategoryId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeaturedCategory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FeaturedCategory" ADD CONSTRAINT "FeaturedCategory_subCategoryId_fkey" FOREIGN KEY ("subCategoryId") REFERENCES "SubCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
