/*
  Warnings:

  - The `deliveryMethod` column on the `Order` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `trxId` on the `Payment` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[transactionId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `transactionId` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Payment` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('HOME', 'PICKUP', 'COURIER');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'VERIFICATION_FAILED', 'PENDING_REVIEW');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'BLOCKED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "FeeType" AS ENUM ('FIXED', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'RECONCILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentMethod" ADD VALUE 'ROCKET';
ALTER TYPE "PaymentMethod" ADD VALUE 'BANK_TRANSFER';
ALTER TYPE "PaymentMethod" ADD VALUE 'CARD';
ALTER TYPE "PaymentMethod" ADD VALUE 'MOBILE_BANKING';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentStatus" ADD VALUE 'PROCESSING';
ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIALLY_REFUNDED';
ALTER TYPE "PaymentStatus" ADD VALUE 'CANCELLED';
ALTER TYPE "PaymentStatus" ADD VALUE 'EXPIRED';
ALTER TYPE "PaymentStatus" ADD VALUE 'ON_HOLD';

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "deliveryMethod",
ADD COLUMN     "deliveryMethod" "DeliveryMethod";

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "trxId",
ADD COLUMN     "collectedAt" TIMESTAMP(3),
ADD COLUMN     "collectedBy" TEXT,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "convenienceFee" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "dueAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "failedAt" TIMESTAMP(3),
ADD COLUMN     "gateway" TEXT,
ADD COLUMN     "gatewayBatchId" TEXT,
ADD COLUMN     "gatewayRefId" TEXT,
ADD COLUMN     "gatewayResponse" JSONB,
ADD COLUMN     "gatewayTranId" TEXT,
ADD COLUMN     "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "lastRetryAt" TIMESTAMP(3),
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "methodDetails" JSONB,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "paymentSettlementId" INTEGER,
ADD COLUMN     "rawResponse" JSONB,
ADD COLUMN     "refundedAt" TIMESTAMP(3),
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "riskLevel" "RiskLevel" DEFAULT 'LOW',
ADD COLUMN     "transactionId" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "PaymentRefund" (
    "id" SERIAL NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "gatewayRefundId" TEXT,
    "requestedBy" INTEGER,
    "processedBy" INTEGER,
    "processedAt" TIMESTAMP(3),
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentLog" (
    "id" SERIAL NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "gatewayResponse" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethodConfig" (
    "id" SERIAL NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "gateway" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isSandbox" BOOLEAN NOT NULL DEFAULT false,
    "displayName" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "minAmount" DOUBLE PRECISION,
    "maxAmount" DOUBLE PRECISION,
    "convenienceFeeType" "FeeType",
    "convenienceFeeValue" DOUBLE PRECISION DEFAULT 0,
    "config" JSONB,
    "availableForCODOnly" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethodConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSettlement" (
    "id" SERIAL NOT NULL,
    "gateway" TEXT NOT NULL,
    "settlementDate" TIMESTAMP(3) NOT NULL,
    "settlementId" TEXT,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "totalFees" DOUBLE PRECISION NOT NULL,
    "netAmount" DOUBLE PRECISION NOT NULL,
    "transactionCount" INTEGER NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "reconciledAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentSettlement_settlementId_key" ON "PaymentSettlement"("settlementId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_transactionId_key" ON "Payment"("transactionId");

-- CreateIndex
CREATE INDEX "Payment_gatewayTranId_idx" ON "Payment"("gatewayTranId");

-- CreateIndex
CREATE INDEX "Payment_transactionId_idx" ON "Payment"("transactionId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paymentSettlementId_fkey" FOREIGN KEY ("paymentSettlementId") REFERENCES "PaymentSettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentLog" ADD CONSTRAINT "PaymentLog_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
