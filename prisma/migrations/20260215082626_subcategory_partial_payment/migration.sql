-- AlterTable
ALTER TABLE "SubCategory" ADD COLUMN     "advancePercentage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isAdvancePayment" BOOLEAN NOT NULL DEFAULT false;
