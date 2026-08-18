/*
  Warnings:

  - Added the required column `updatedAt` to the `ProductSize` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ApiClientStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- AlterTable
-- `updatedAt` is given a column-level default (not just Prisma's `@updatedAt`
-- app-level behavior) so this ADD COLUMN backfills existing rows instead of
-- failing NOT NULL against the table's current data.
ALTER TABLE "ProductSize" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "ApiClient" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "hashedSecret" TEXT NOT NULL,
    "scopes" TEXT[],
    "status" "ApiClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "rateLimitPerMinute" INTEGER NOT NULL DEFAULT 60,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdByAdminId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKeyRequestLog" (
    "id" SERIAL NOT NULL,
    "apiClientId" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKeyRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiClient_keyPrefix_key" ON "ApiClient"("keyPrefix");

-- CreateIndex
CREATE INDEX "ApiKeyRequestLog_apiClientId_createdAt_idx" ON "ApiKeyRequestLog"("apiClientId", "createdAt");

-- AddForeignKey
ALTER TABLE "ApiClient" ADD CONSTRAINT "ApiClient_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeyRequestLog" ADD CONSTRAINT "ApiKeyRequestLog_apiClientId_fkey" FOREIGN KEY ("apiClientId") REFERENCES "ApiClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
