-- AlterTable
ALTER TABLE "OTP" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "OTP_phone_type_createdAt_idx" ON "OTP"("phone", "type", "createdAt");
