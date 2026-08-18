-- CreateEnum
CREATE TYPE "ShipmentGroupStatus" AS ENUM ('OPEN', 'SHIPPED');

-- CreateTable
CREATE TABLE "ShipmentGroup" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "status" "ShipmentGroupStatus" NOT NULL DEFAULT 'OPEN',
    "courierShipmentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShipmentGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLineReservation" (
    "id" SERIAL NOT NULL,
    "orderItemId" INTEGER NOT NULL,
    "pieceId" INTEGER NOT NULL,
    "shipmentGroupId" INTEGER NOT NULL,
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reservedByUserId" INTEGER,
    "pickedAt" TIMESTAMP(3),
    "pickedByUserId" INTEGER,

    CONSTRAINT "OrderLineReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShipmentGroup_orderId_key" ON "ShipmentGroup"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "ShipmentGroup_courierShipmentId_key" ON "ShipmentGroup"("courierShipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderLineReservation_pieceId_key" ON "OrderLineReservation"("pieceId");

-- CreateIndex
CREATE INDEX "OrderLineReservation_shipmentGroupId_idx" ON "OrderLineReservation"("shipmentGroupId");

-- CreateIndex
CREATE INDEX "OrderLineReservation_orderItemId_idx" ON "OrderLineReservation"("orderItemId");

-- AddForeignKey
ALTER TABLE "ShipmentGroup" ADD CONSTRAINT "ShipmentGroup_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentGroup" ADD CONSTRAINT "ShipmentGroup_courierShipmentId_fkey" FOREIGN KEY ("courierShipmentId") REFERENCES "CourierShipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLineReservation" ADD CONSTRAINT "OrderLineReservation_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLineReservation" ADD CONSTRAINT "OrderLineReservation_pieceId_fkey" FOREIGN KEY ("pieceId") REFERENCES "Piece"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLineReservation" ADD CONSTRAINT "OrderLineReservation_shipmentGroupId_fkey" FOREIGN KEY ("shipmentGroupId") REFERENCES "ShipmentGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLineReservation" ADD CONSTRAINT "OrderLineReservation_reservedByUserId_fkey" FOREIGN KEY ("reservedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLineReservation" ADD CONSTRAINT "OrderLineReservation_pickedByUserId_fkey" FOREIGN KEY ("pickedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
