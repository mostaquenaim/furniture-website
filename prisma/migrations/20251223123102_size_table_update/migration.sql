/*
  Warnings:

  - Added the required column `isActive` to the `Size` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Size" ADD COLUMN     "isActive" BOOLEAN NOT NULL;
