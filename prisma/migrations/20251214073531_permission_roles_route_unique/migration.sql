/*
  Warnings:

  - A unique constraint covering the columns `[route]` on the table `Permission` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Permission_route_key" ON "Permission"("route");
