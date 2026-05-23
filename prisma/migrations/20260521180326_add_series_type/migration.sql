-- CreateEnum
CREATE TYPE "SeriesType" AS ENUM ('NORMAL', 'SALE', 'NEW');

-- AlterTable
ALTER TABLE "Series" ADD COLUMN     "seriesType" "SeriesType" NOT NULL DEFAULT 'NORMAL';
