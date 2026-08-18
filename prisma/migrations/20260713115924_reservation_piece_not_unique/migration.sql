-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "discountEnd" DROP NOT NULL,
ALTER COLUMN "discountEnd" DROP DEFAULT,
ALTER COLUMN "discountStart" DROP NOT NULL,
ALTER COLUMN "discountStart" DROP DEFAULT;

-- CreateTable
CREATE TABLE "UrgencyBanner" (
    "id" SERIAL NOT NULL,
    "message" TEXT NOT NULL,
    "eventType" TEXT,
    "link" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UrgencyBanner_pkey" PRIMARY KEY ("id")
);
