-- DropIndex
DROP INDEX "Cart_userId_status_idx";

-- CreateIndex
CREATE INDEX "Cart_userId_visitorId_status_idx" ON "Cart"("userId", "visitorId", "status");
