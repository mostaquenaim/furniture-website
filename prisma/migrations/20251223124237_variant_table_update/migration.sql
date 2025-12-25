/*
  Warnings:

  - You are about to drop the column `isActive` on the `Size` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `Variant` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Size" DROP COLUMN "isActive";

-- AlterTable
ALTER TABLE "Variant" DROP COLUMN "isActive";
