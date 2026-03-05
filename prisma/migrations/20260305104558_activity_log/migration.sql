/*
  Warnings:

  - Added the required column `module` to the `ActivityLog` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "LogModule" AS ENUM ('PRODUCT', 'ORDER', 'USER', 'COUPON', 'INVENTORY', 'BARCODE', 'PAYMENT', 'BANNER', 'CATEGORY', 'BLOG', 'SUPPORT', 'AUTH', 'SYSTEM');

-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "module" "LogModule" NOT NULL,
ADD COLUMN     "targetId" TEXT,
ADD COLUMN     "targetLabel" TEXT,
ADD COLUMN     "userAgent" TEXT;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
