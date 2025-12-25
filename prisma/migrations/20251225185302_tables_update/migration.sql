-- DropIndex
DROP INDEX "Product_sku_key";

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "sku" DROP NOT NULL;
