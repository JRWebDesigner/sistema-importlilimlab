-- CreateEnum
CREATE TYPE "ProformaStatus" AS ENUM ('SENT', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "Proforma" (
    "id" TEXT NOT NULL,
    "number" VARCHAR(30) NOT NULL,
    "status" "ProformaStatus" NOT NULL DEFAULT 'SENT',
    "paymentMethod" "PaymentMethod",
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 13,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "taxAmount" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "notes" VARCHAR(500),
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),

    CONSTRAINT "Proforma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProformaItem" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "proformaId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "ProformaItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Proforma_number_key" ON "Proforma"("number");

-- CreateIndex
CREATE INDEX "Proforma_customerId_status_idx" ON "Proforma"("customerId", "status");

-- CreateIndex
CREATE INDEX "Proforma_createdAt_idx" ON "Proforma"("createdAt");

-- CreateIndex
CREATE INDEX "ProformaItem_productId_idx" ON "ProformaItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProformaItem_proformaId_productId_key" ON "ProformaItem"("proformaId", "productId");

-- AddForeignKey
ALTER TABLE "Proforma" ADD CONSTRAINT "Proforma_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProformaItem" ADD CONSTRAINT "ProformaItem_proformaId_fkey" FOREIGN KEY ("proformaId") REFERENCES "Proforma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProformaItem" ADD CONSTRAINT "ProformaItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
