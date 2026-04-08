/*
  Warnings:

  - You are about to drop the `HomepageBanner` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "Banner" ADD COLUMN     "device" TEXT;

-- DropTable
DROP TABLE "HomepageBanner";
