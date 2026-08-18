-- AlterEnum
ALTER TYPE "LogModule" ADD VALUE 'SERIES';

-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN     "statement" TEXT;
