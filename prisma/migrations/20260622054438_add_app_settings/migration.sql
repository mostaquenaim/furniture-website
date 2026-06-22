-- CreateTable
CREATE TABLE "AppSettings" (
    "id" SERIAL NOT NULL,
    "defaultDeliveryFee" DOUBLE PRECISION NOT NULL DEFAULT 120,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);
