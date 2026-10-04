import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const tx = await prisma.stockTransaction.findMany({ orderBy: { createdAt: 'asc' }, select: { type: true, quantity: true, createdAt: true } });
const adj = await prisma.stockAdjustment.findMany({ orderBy: { createdAt: 'asc' }, select: { createdAt: true, difference: true } });
const items = await prisma.batchStock.findMany({ select: { quantity: true, batch: { select: { expiryDate: true } } } });

const day = 86400000;
const now = Date.now();
const buckets = { '<=0': 0, '1-30': 0, '31-90': 0, '>90': 0 };
for (const item of items) {
  const d = Math.ceil((new Date(item.batch.expiryDate).getTime() - now) / day);
  if (d <= 0) buckets['<=0'] += 1;
  else if (d <= 30) buckets['1-30'] += 1;
  else if (d <= 90) buckets['31-90'] += 1;
  else buckets['>90'] += 1;
}

const inSum = tx.filter((t) => t.type === 'IN').reduce((s, t) => s + t.quantity, 0);
const outSum = tx.filter((t) => t.type === 'OUT').reduce((s, t) => s + t.quantity, 0);
const ages = tx.map((t) => Math.floor((now - new Date(t.createdAt).getTime()) / day));

console.log({
  transactions: tx.length,
  inSum,
  outSum,
  oldestDays: ages.length ? Math.max(...ages) : null,
  newestDays: ages.length ? Math.min(...ages) : null,
  adjustments: adj.length,
  stockRecords: items.length,
  expiryBuckets: buckets,
  sampleTx: tx.slice(-3),
});
await prisma.$disconnect();
