-- AlterTable
ALTER TABLE "company_info" ADD COLUMN     "privacyPolicy" TEXT;

-- CreateTable
CREATE TABLE "terms_and_conditions" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER,

    CONSTRAINT "terms_and_conditions_pkey" PRIMARY KEY ("id")
);
