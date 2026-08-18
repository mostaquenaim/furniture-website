-- AlterTable
ALTER TABLE "CourierShipment" ADD COLUMN     "deliveryType" INTEGER,
ADD COLUMN     "itemDescription" TEXT,
ADD COLUMN     "itemType" INTEGER,
ADD COLUMN     "recipientAddress" TEXT,
ADD COLUMN     "recipientName" TEXT,
ADD COLUMN     "recipientPhone" TEXT,
ADD COLUMN     "specialInstruction" TEXT,
ADD COLUMN     "weight" DOUBLE PRECISION;
