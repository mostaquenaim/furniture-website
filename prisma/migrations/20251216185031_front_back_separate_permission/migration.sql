/*
  Warnings:

  - You are about to drop the `Permission` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "Permission";

-- CreateTable
CREATE TABLE "FrontendPermission" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "component" TEXT,
    "roles" "UserRole"[],

    CONSTRAINT "FrontendPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackendPermission" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT,
    "resource" TEXT,
    "action" TEXT,
    "roles" "UserRole"[],

    CONSTRAINT "BackendPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FrontendPermission_name_key" ON "FrontendPermission"("name");

-- CreateIndex
CREATE UNIQUE INDEX "FrontendPermission_path_key" ON "FrontendPermission"("path");

-- CreateIndex
CREATE UNIQUE INDEX "BackendPermission_name_key" ON "BackendPermission"("name");

-- CreateIndex
CREATE UNIQUE INDEX "BackendPermission_endpoint_key" ON "BackendPermission"("endpoint");
