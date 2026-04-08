/*
  Warnings:

  - Made the column `title` on table `Banner` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `title` to the `PromoBanner` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Banner" ALTER COLUMN "title" SET NOT NULL;

-- AlterTable
ALTER TABLE "PromoBanner" ADD COLUMN     "title" TEXT NOT NULL;
