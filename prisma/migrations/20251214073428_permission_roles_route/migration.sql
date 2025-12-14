/*
  Warnings:

  - Added the required column `route` to the `Permission` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Permission" ADD COLUMN     "route" TEXT NOT NULL;
