-- CreateEnum
CREATE TYPE "FraudStatus" AS ENUM ('SAFE', 'SUSPICIOUS', 'DOUBTFUL', 'BLOCKED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "fraudStatus" "FraudStatus" NOT NULL DEFAULT 'SAFE';
