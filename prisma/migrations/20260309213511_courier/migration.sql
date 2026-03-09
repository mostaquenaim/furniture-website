-- CreateEnum
CREATE TYPE "CourierStatus" AS ENUM ('PENDING', 'BOOKED', 'PICKUP_ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'PARTIALLY_DELIVERED', 'RETURNED', 'CANCELLED', 'ON_HOLD', 'FAILED');

-- CreateTable
CREATE TABLE "CourierProvider" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "logo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourierProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourierShipment" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "providerId" INTEGER NOT NULL,
    "consignmentId" TEXT,
    "trackingNumber" TEXT,
    "trackingUrl" TEXT,
    "labelUrl" TEXT,
    "manifestUrl" TEXT,
    "status" "CourierStatus" NOT NULL DEFAULT 'PENDING',
    "providerStatus" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "deliveryCharge" DOUBLE PRECISION,
    "codAmount" DOUBLE PRECISION,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourierShipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourierWebhookLog" (
    "id" SERIAL NOT NULL,
    "provider" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "shipmentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourierWebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourierRate" (
    "id" SERIAL NOT NULL,
    "providerId" INTEGER NOT NULL,
    "districtId" INTEGER,
    "weightMin" DOUBLE PRECISION NOT NULL,
    "weightMax" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "codFee" DOUBLE PRECISION,
    "deliveryTime" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourierRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourierProvider_name_key" ON "CourierProvider"("name");

-- CreateIndex
CREATE INDEX "CourierShipment_trackingNumber_idx" ON "CourierShipment"("trackingNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CourierShipment_orderId_providerId_key" ON "CourierShipment"("orderId", "providerId");

-- AddForeignKey
ALTER TABLE "CourierShipment" ADD CONSTRAINT "CourierShipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierShipment" ADD CONSTRAINT "CourierShipment_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "CourierProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierWebhookLog" ADD CONSTRAINT "CourierWebhookLog_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "CourierShipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierRate" ADD CONSTRAINT "CourierRate_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "CourierProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierRate" ADD CONSTRAINT "CourierRate_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;
