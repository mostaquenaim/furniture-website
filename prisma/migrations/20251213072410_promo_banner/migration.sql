-- CreateTable
CREATE TABLE "PromoBanner" (
    "id" SERIAL NOT NULL,
    "text" TEXT NOT NULL,
    "bgColor" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoBanner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoBannerLink" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "bannerId" INTEGER NOT NULL,

    CONSTRAINT "PromoBannerLink_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PromoBannerLink" ADD CONSTRAINT "PromoBannerLink_bannerId_fkey" FOREIGN KEY ("bannerId") REFERENCES "PromoBanner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
