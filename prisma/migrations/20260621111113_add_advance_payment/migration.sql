-- CreateEnum
CREATE TYPE "PaymentPhase" AS ENUM ('FULL', 'ADVANCE', 'REMAINDER');

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIALLY_PAID';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "advanceAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "advancePercentage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "advanceRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "remainingAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "phase" "PaymentPhase" NOT NULL DEFAULT 'FULL';
