-- CreateTable
CREATE TABLE "FraudCheck" (
    "id" SERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "delivered" INTEGER NOT NULL DEFAULT 0,
    "returned" INTEGER NOT NULL DEFAULT 0,
    "successRatio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fraudReportCount" INTEGER NOT NULL DEFAULT 0,
    "riskLevel" TEXT NOT NULL DEFAULT 'Low',
    "riskScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "computedStatus" "FraudStatus" NOT NULL DEFAULT 'SAFE',
    "userId" INTEGER,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FraudCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FraudCheck_phone_idx" ON "FraudCheck"("phone");

-- AddForeignKey
ALTER TABLE "FraudCheck" ADD CONSTRAINT "FraudCheck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
