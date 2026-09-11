-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD');

-- AlterTable
ALTER TABLE "InventoryMovement" ADD COLUMN     "currency" "Currency" NOT NULL DEFAULT 'USD';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "currency" "Currency" NOT NULL DEFAULT 'USD';
