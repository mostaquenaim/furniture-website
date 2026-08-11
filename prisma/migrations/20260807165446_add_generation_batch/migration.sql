-- AlterTable
ALTER TABLE "Piece" ADD COLUMN     "generateBatchId" TEXT;

-- CreateTable
CREATE TABLE "GenerationBatch" (
    "id" TEXT NOT NULL,
    "productSizeId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GenerationBatch_productSizeId_idx" ON "GenerationBatch"("productSizeId");

-- CreateIndex
CREATE INDEX "Piece_generateBatchId_idx" ON "Piece"("generateBatchId");

-- AddForeignKey
ALTER TABLE "Piece" ADD CONSTRAINT "Piece_generateBatchId_fkey" FOREIGN KEY ("generateBatchId") REFERENCES "GenerationBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationBatch" ADD CONSTRAINT "GenerationBatch_productSizeId_fkey" FOREIGN KEY ("productSizeId") REFERENCES "ProductSize"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationBatch" ADD CONSTRAINT "GenerationBatch_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
