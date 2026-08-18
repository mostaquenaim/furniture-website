/*
  Warnings:

  - Added the required column `isActive` to the `Variant` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Variant" ADD COLUMN     "isActive" BOOLEAN NOT NULL;
