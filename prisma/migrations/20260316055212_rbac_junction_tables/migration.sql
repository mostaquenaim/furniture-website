/*
  Warnings:

  - You are about to drop the `BackendPermission` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FrontendPermission` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "BackendPermission";

-- DropTable
DROP TABLE "FrontendPermission";

-- CreateTable
CREATE TABLE "frontend_permissions" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "component" TEXT,

    CONSTRAINT "frontend_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "frontend_role_permissions" (
    "id" SERIAL NOT NULL,
    "role" "UserRole" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "frontendPermissionId" INTEGER NOT NULL,

    CONSTRAINT "frontend_role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backend_permissions" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT,
    "resource" TEXT,
    "action" TEXT,

    CONSTRAINT "backend_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backend_role_permissions" (
    "id" SERIAL NOT NULL,
    "role" "UserRole" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "backendPermissionId" INTEGER NOT NULL,

    CONSTRAINT "backend_role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "frontend_permissions_name_key" ON "frontend_permissions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "frontend_permissions_path_key" ON "frontend_permissions"("path");

-- CreateIndex
CREATE UNIQUE INDEX "frontend_role_permissions_frontendPermissionId_role_key" ON "frontend_role_permissions"("frontendPermissionId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "backend_permissions_name_key" ON "backend_permissions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "backend_permissions_endpoint_method_key" ON "backend_permissions"("endpoint", "method");

-- CreateIndex
CREATE UNIQUE INDEX "backend_role_permissions_backendPermissionId_role_key" ON "backend_role_permissions"("backendPermissionId", "role");

-- AddForeignKey
ALTER TABLE "frontend_role_permissions" ADD CONSTRAINT "frontend_role_permissions_frontendPermissionId_fkey" FOREIGN KEY ("frontendPermissionId") REFERENCES "frontend_permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backend_role_permissions" ADD CONSTRAINT "backend_role_permissions_backendPermissionId_fkey" FOREIGN KEY ("backendPermissionId") REFERENCES "backend_permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
