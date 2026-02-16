/*
  Warnings:

  - A unique constraint covering the columns `[endpoint,method]` on the table `BackendPermission` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "BackendPermission_endpoint_key";

-- CreateIndex
CREATE UNIQUE INDEX "BackendPermission_endpoint_method_key" ON "BackendPermission"("endpoint", "method");
