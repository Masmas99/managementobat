import { PrismaClient } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const prisma = new PrismaClient();
const inventory = JSON.parse(await readFile(new URL('../data/inventory.json', import.meta.url), 'utf8'));
const passwordHash = (value) => createHash('sha256').update(value).digest('hex');
const batchId = (item) => `BATCH-${item.id}-${item.batch}`.replace(/[^a-zA-Z0-9_-]/g, '-');

await prisma.stockTransaction.deleteMany();
await prisma.stockAdjustment.deleteMany();
await prisma.batchStock.deleteMany();
await prisma.medicineBatch.deleteMany();
await prisma.medicineProduct.deleteMany();
await prisma.supplier.deleteMany();
await prisma.medicineCategory.deleteMany();
await prisma.storageLocation.deleteMany();
await prisma.user.deleteMany();

const suppliers = [...new Set(inventory.map((item) => item.supplier))].map((name, index) => ({ id: `SUP-${String(index + 1).padStart(3, '0')}`, name }));
const categories = [...new Set(inventory.map((item) => item.category))].map((name, index) => ({ id: `CAT-${String(index + 1).padStart(3, '0')}`, name }));
const locations = [...new Set(inventory.map((item) => item.location))].map((name, index) => ({ id: `LOC-${String(index + 1).padStart(3, '0')}`, name }));

await prisma.supplier.createMany({ data: suppliers });
await prisma.medicineCategory.createMany({ data: categories });
await prisma.storageLocation.createMany({ data: locations });
await prisma.medicineProduct.createMany({
  data: inventory.map((item) => ({
    id: item.id,
    name: item.name,
    genericName: item.generic,
    category: item.category,
    categoryId: categories.find((entry) => entry.name === item.category).id,
    strength: item.name.match(/\d+\s*(?:mg|ml|mcg|g)/i)?.[0] || null,
  })),
});
await prisma.medicineBatch.createMany({
  data: inventory.map((item) => ({
    id: batchId(item),
    productId: item.id,
    batchNumber: item.batch,
    expiryDate: new Date(`${item.nearestExpiry}T00:00:00.000Z`),
    supplierId: suppliers.find((entry) => entry.name === item.supplier).id,
    status: item.status === 'EXPIRED' ? 'EXPIRED' : 'RELEASED',
  })),
});
await prisma.batchStock.createMany({
  data: inventory.map((item) => ({
    id: item.id,
    batchId: batchId(item),
    locationId: locations.find((entry) => entry.name === item.location).id,
    quantity: item.stock,
    minimum: item.minimum,
    unitPrice: item.unitPrice,
    status: item.stock === 0 ? 'OUT_OF_STOCK' : item.stock < item.minimum ? 'LOW_STOCK' : 'NORMAL',
  })),
});
await prisma.stockTransaction.createMany({
  data: inventory.map((item, index) => ({
    batchStockId: item.id,
    type: 'IN',
    quantity: item.stock,
    stockBefore: 0,
    stockAfter: item.stock,
    createdAt: new Date(Date.now() - index * 60 * 60 * 1000),
  })),
});

const users = [
  { id: 'USR-001', name: 'Andi Saputra', email: 'andi@medistock.local', role: 'Admin Farmasi', password: 'change-me' },
  { id: 'USR-002', name: 'Sari Wulandari', email: 'sari@medistock.local', role: 'Super Admin', password: 'super123' },
  { id: 'USR-003', name: 'Budi Santoso', email: 'gudang@medistock.local', role: 'Petugas Gudang', password: 'gudang123' },
  { id: 'USR-004', name: 'Maya Putri', email: 'viewer@medistock.local', role: 'Viewer', password: 'viewer123' },
];
await prisma.user.createMany({
  data: users.map((user) => ({ id: user.id, name: user.name, email: user.email, role: user.role, status: 'ACTIVE', passwordHash: passwordHash(user.password), avatarUrl: '' })),
});

await prisma.$disconnect();
console.log(`Seeded ${inventory.length} products, ${inventory.length} batches, ${inventory.length} stock records, ${suppliers.length} suppliers, ${categories.length} categories, ${locations.length} locations, and ${users.length} users.`);
