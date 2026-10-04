import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const now = new Date();

async function tableExists(name) {
  const rows = await prisma.$queryRawUnsafe(`SELECT to_regclass('public.${name}')::text AS name`);
  return Boolean(rows[0]?.name);
}

async function main() {
  if (await tableExists('medicine_products')) {
    console.log('Migration dilewati: tabel relasional baru sudah tersedia.');
    return;
  }
  if (!(await tableExists('inventory_items'))) {
    console.log('Tidak ada tabel legacy inventory_items. Jalankan prisma db push lalu db:seed untuk database baru.');
    return;
  }

  const legacyItems = await prisma.$queryRawUnsafe('SELECT * FROM "inventory_items" ORDER BY "id"');
  const legacyTransactions = await prisma.$queryRawUnsafe('SELECT * FROM "stock_transactions" ORDER BY "createdAt"');
  const legacyAdjustments = await prisma.$queryRawUnsafe('SELECT * FROM "stock_adjustments" ORDER BY "createdAt"');

  await prisma.$executeRawUnsafe('ALTER TABLE "stock_transactions" RENAME TO "legacy_stock_transactions"');
  await prisma.$executeRawUnsafe('ALTER TABLE "stock_adjustments" RENAME TO "legacy_stock_adjustments"');
  await prisma.$executeRawUnsafe('ALTER TABLE "inventory_items" RENAME TO "legacy_inventory_items"');

  await prisma.$executeRawUnsafe('CREATE TYPE "BatchStatus" AS ENUM (\'RELEASED\', \'QUARANTINED\', \'RECALLED\', \'EXPIRED\')');
  await prisma.$executeRawUnsafe('CREATE TYPE "StockStatus" AS ENUM (\'NORMAL\', \'LOW_STOCK\', \'OUT_OF_STOCK\')');
  await prisma.$executeRawUnsafe(`CREATE TABLE "medicine_products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "genericName" TEXT NOT NULL,
    "strength" TEXT,
    "dosageForm" TEXT,
    "route" TEXT,
    "category" TEXT NOT NULL,
    "categoryId" TEXT,
    "manufacturer" TEXT,
    "registrationNo" TEXT,
    "gtin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
  )`);
  await prisma.$executeRawUnsafe(`CREATE TABLE "medicine_batches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "manufacturedAt" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "supplierId" TEXT,
    "manufacturer" TEXT,
    "status" "BatchStatus" NOT NULL DEFAULT 'RELEASED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "medicine_batches_productId_fkey" FOREIGN KEY ("productId") REFERENCES "medicine_products"("id") ON DELETE CASCADE,
    CONSTRAINT "medicine_batches_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL,
    CONSTRAINT "medicine_batches_productId_batchNumber_key" UNIQUE ("productId", "batchNumber")
  )`);
  await prisma.$executeRawUnsafe(`CREATE TABLE "batch_stocks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "locationId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "minimum" INTEGER NOT NULL DEFAULT 0,
    "unitPrice" INTEGER NOT NULL DEFAULT 0,
    "status" "StockStatus" NOT NULL DEFAULT 'OUT_OF_STOCK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "batch_stocks_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "medicine_batches"("id") ON DELETE CASCADE,
    CONSTRAINT "batch_stocks_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "storage_locations"("id") ON DELETE SET NULL,
    CONSTRAINT "batch_stocks_batchId_locationId_key" UNIQUE ("batchId", "locationId")
  )`);
  await prisma.$executeRawUnsafe(`CREATE TABLE "stock_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchStockId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "stockBefore" INTEGER NOT NULL,
    "stockAfter" INTEGER NOT NULL,
    "performedBy" TEXT,
    "referenceNo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_transactions_batchStockId_fkey" FOREIGN KEY ("batchStockId") REFERENCES "batch_stocks"("id") ON DELETE CASCADE
  )`);
  await prisma.$executeRawUnsafe(`CREATE TABLE "stock_adjustments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchStockId" TEXT NOT NULL,
    "stockBefore" INTEGER NOT NULL,
    "physicalStock" INTEGER NOT NULL,
    "difference" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "performedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_adjustments_batchStockId_fkey" FOREIGN KEY ("batchStockId") REFERENCES "batch_stocks"("id") ON DELETE CASCADE
  )`);

  for (const item of legacyItems) {
    const batchId = `BATCH-${item.id}-${item.batch}`.replace(/[^a-zA-Z0-9_-]/g, '-');
    await prisma.medicineProduct.create({ data: { id: item.id, name: item.name, genericName: item.generic, category: item.category, categoryId: item.categoryId, strength: item.name.match(/\d+\s*(?:mg|ml|mcg|g)/i)?.[0] || null, createdAt: item.createdAt || now, updatedAt: item.updatedAt || now } });
    await prisma.medicineBatch.create({ data: { id: batchId, productId: item.id, batchNumber: item.batch, expiryDate: item.nearestExpiry, supplierId: item.supplierId, status: item.status === 'EXPIRED' ? 'EXPIRED' : 'RELEASED', createdAt: item.createdAt || now, updatedAt: item.updatedAt || now } });
    await prisma.batchStock.create({ data: { id: item.id, batchId, locationId: item.locationId, quantity: item.stock, minimum: item.minimum, unitPrice: item.unitPrice, status: item.stock === 0 ? 'OUT_OF_STOCK' : item.stock < item.minimum ? 'LOW_STOCK' : 'NORMAL', createdAt: item.createdAt || now, updatedAt: item.updatedAt || now } });
  }
  for (const transaction of legacyTransactions) {
    await prisma.stockTransaction.create({ data: { id: transaction.id, batchStockId: transaction.inventoryId, type: transaction.type, quantity: transaction.quantity, stockBefore: transaction.stockBefore, stockAfter: transaction.stockAfter, createdAt: transaction.createdAt } });
  }
  for (const adjustment of legacyAdjustments) {
    await prisma.stockAdjustment.create({ data: { id: adjustment.id, batchStockId: adjustment.inventoryId, stockBefore: adjustment.stockBefore, physicalStock: adjustment.physicalStock, difference: adjustment.difference, reason: adjustment.reason, createdAt: adjustment.createdAt } });
  }
  console.log(`Migration selesai: ${legacyItems.length} produk/batch/stok, ${legacyTransactions.length} transaksi, ${legacyAdjustments.length} penyesuaian.`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
