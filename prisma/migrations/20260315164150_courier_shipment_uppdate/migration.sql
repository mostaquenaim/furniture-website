/*
  Warnings:

  - You are about to drop the column `specialInstruction` on the `CourierShipment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CourierShipment" DROP COLUMN "specialInstruction",
ADD COLUMN     "special_instruction" TEXT;
