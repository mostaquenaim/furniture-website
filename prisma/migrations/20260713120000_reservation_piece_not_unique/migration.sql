-- DropIndex
DROP INDEX "OrderLineReservation_pieceId_key";

-- CreateIndex
CREATE INDEX "OrderLineReservation_pieceId_idx" ON "OrderLineReservation"("pieceId");
