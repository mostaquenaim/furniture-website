/*
  Warnings:

  - You are about to drop the `backend_permissions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `backend_role_permissions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `frontend_permissions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `frontend_role_permissions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "backend_role_permissions" DROP CONSTRAINT "backend_role_permissions_backendPermissionId_fkey";

-- DropForeignKey
ALTER TABLE "frontend_role_permissions" DROP CONSTRAINT "frontend_role_permissions_frontendPermissionId_fkey";

-- DropTable
DROP TABLE "backend_permissions";

-- DropTable
DROP TABLE "backend_role_permissions";

-- DropTable
DROP TABLE "frontend_permissions";

-- DropTable
DROP TABLE "frontend_role_permissions";

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" SERIAL NOT NULL,
    "role" "UserRole" NOT NULL,
    "action" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_action_key" ON "role_permissions"("role", "action");
