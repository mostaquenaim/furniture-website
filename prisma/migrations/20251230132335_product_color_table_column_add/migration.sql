/*
  Warnings:

  - You are about to drop the `ProductStock` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "ProductColor" ADD COLUMN     "useDefaultImages" BOOLEAN NOT NULL DEFAULT true;

-- DropTable
DROP TABLE "ProductStock";
