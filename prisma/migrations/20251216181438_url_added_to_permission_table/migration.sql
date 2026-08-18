/*
  Warnings:

  - Added the required column `url` to the `Permission` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Permission" ADD COLUMN     "url" TEXT NOT NULL;
