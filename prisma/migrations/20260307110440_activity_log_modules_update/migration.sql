/*
  Warnings:

  - The values [COUPON,BARCODE,PAYMENT,BANNER,CATEGORY,BLOG,SERIES,SUBCATEGORY,COLOR,MATERIAL] on the enum `LogModule` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "LogModule_new" AS ENUM ('CATALOG', 'PRODUCT', 'ORDER', 'USER', 'MARKETING', 'INVENTORY', 'CONTENT', 'SUPPORT', 'AUTH', 'SYSTEM');
ALTER TABLE "ActivityLog" ALTER COLUMN "module" TYPE "LogModule_new" USING ("module"::text::"LogModule_new");
ALTER TYPE "LogModule" RENAME TO "LogModule_old";
ALTER TYPE "LogModule_new" RENAME TO "LogModule";
DROP TYPE "public"."LogModule_old";
COMMIT;
