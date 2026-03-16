-- CreateTable
CREATE TABLE "company_info" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Sakigai',
    "logo" TEXT,
    "favicon" TEXT,
    "tagline" TEXT,
    "about" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "googleMapUrl" TEXT,
    "facebook" TEXT,
    "instagram" TEXT,
    "youtube" TEXT,
    "tiktok" TEXT,
    "twitter" TEXT,
    "linkedin" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "ogImage" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER,

    CONSTRAINT "company_info_pkey" PRIMARY KEY ("id")
);
