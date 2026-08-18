-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "courierLabelHeightMm" DOUBLE PRECISION NOT NULL DEFAULT 150,
ADD COLUMN     "courierLabelWidthMm" DOUBLE PRECISION NOT NULL DEFAULT 100,
ADD COLUMN     "invoicePaperHeightMm" DOUBLE PRECISION,
ADD COLUMN     "invoicePaperSize" TEXT NOT NULL DEFAULT 'A4',
ADD COLUMN     "invoicePaperWidthMm" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "label_sizes" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "widthMm" DOUBLE PRECISION NOT NULL,
    "heightMm" DOUBLE PRECISION NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "label_sizes_pkey" PRIMARY KEY ("id")
);
