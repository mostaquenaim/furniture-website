-- CreateEnum
CREATE TYPE "ProductTrackingMode" AS ENUM ('LEGACY_QUANTITY', 'PIECE_BARCODE');

-- CreateEnum
CREATE TYPE "PieceStatus" AS ENUM ('CREATED', 'DAMAGED_INCOMING', 'IN_STOCK', 'RESERVED', 'PICKED', 'SHIPPED', 'DELIVERED', 'RETURNING', 'RETURNED_IN_STOCK', 'DAMAGED_RETURN');

-- AlterTable
ALTER TABLE "ProductSize" ADD COLUMN     "trackingMode" "ProductTrackingMode" NOT NULL DEFAULT 'LEGACY_QUANTITY';

-- CreateTable
CREATE TABLE "Supplier" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Piece" (
    "id" SERIAL NOT NULL,
    "barcodeValue" TEXT NOT NULL,
    "productSizeId" INTEGER NOT NULL,
    "supplierId" INTEGER,
    "status" "PieceStatus" NOT NULL DEFAULT 'CREATED',
    "locationId" TEXT,
    "receiveBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Piece_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PieceStatusEvent" (
    "id" SERIAL NOT NULL,
    "pieceId" INTEGER NOT NULL,
    "fromStatus" "PieceStatus",
    "toStatus" "PieceStatus" NOT NULL,
    "actorUserId" INTEGER,
    "actorRole" "UserRole",
    "source" TEXT NOT NULL,
    "reasonCode" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PieceStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Piece_barcodeValue_key" ON "Piece"("barcodeValue");

-- CreateIndex
CREATE INDEX "Piece_productSizeId_status_idx" ON "Piece"("productSizeId", "status");

-- CreateIndex
CREATE INDEX "Piece_locationId_idx" ON "Piece"("locationId");

-- CreateIndex
CREATE INDEX "PieceStatusEvent_pieceId_idx" ON "PieceStatusEvent"("pieceId");

-- AddForeignKey
ALTER TABLE "Piece" ADD CONSTRAINT "Piece_productSizeId_fkey" FOREIGN KEY ("productSizeId") REFERENCES "ProductSize"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Piece" ADD CONSTRAINT "Piece_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Piece" ADD CONSTRAINT "Piece_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "WarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PieceStatusEvent" ADD CONSTRAINT "PieceStatusEvent_pieceId_fkey" FOREIGN KEY ("pieceId") REFERENCES "Piece"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PieceStatusEvent" ADD CONSTRAINT "PieceStatusEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
