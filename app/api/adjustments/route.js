import { promises as fs } from 'node:fs';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';

const inventoryPath = path.join(process.cwd(), 'data', 'inventory.json');
const adjustmentsPath = path.join(process.cwd(), 'data', 'adjustments.json');
const useDatabase = Boolean(process.env.DATABASE_URL);

export async function GET() {
  if (useDatabase) {
    try {
      const data = await prisma.stockAdjustment.findMany({ include: { inventory: true }, orderBy: { createdAt: 'desc' } });
      return Response.json({ data });
    } catch {
      // Keep read-only adjustment views usable during a temporary database outage.
    }
  }
  return Response.json({ data: JSON.parse(await fs.readFile(adjustmentsPath, 'utf8')) });
}

export async function POST(request) {
  const { error } = await requirePermission(request, 'adjustStock');
  if (error) return error;
  const { inventoryId, physicalStock, reason } = await request.json();
  const targetStock = Number(physicalStock);
  if (!inventoryId || !Number.isInteger(targetStock) || targetStock < 0 || !reason?.trim()) {
    return Response.json({ error: 'Obat, stok fisik, dan alasan wajib diisi.' }, { status: 400 });
  }

  if (useDatabase) {
    const item = await prisma.inventoryItem.findUnique({ where: { id: inventoryId } });
    if (!item) return Response.json({ error: 'Obat tidak ditemukan.' }, { status: 404 });
    const difference = targetStock - item.stock;
    const status = targetStock === 0 ? 'OUT OF STOCK' : targetStock < item.minimum ? 'LOW STOCK' : 'NORMAL';
    const adjustment = await prisma.$transaction(async (transaction) => {
      const savedItem = await transaction.inventoryItem.update({ where: { id: inventoryId }, data: { stock: targetStock, status } });
      const savedAdjustment = await transaction.stockAdjustment.create({ data: { inventoryId, stockBefore: item.stock, physicalStock: targetStock, difference, reason: reason.trim() } });
      return { savedItem, savedAdjustment };
    });
    return Response.json({ data: adjustment, message: 'Penyesuaian stok berhasil disimpan.' }, { status: 201 });
  }

  const inventory = JSON.parse(await fs.readFile(inventoryPath, 'utf8'));
  const item = inventory.find((entry) => entry.id === inventoryId);
  if (!item) return Response.json({ error: 'Obat tidak ditemukan.' }, { status: 404 });
  const stockBefore = item.stock;
  const difference = targetStock - stockBefore;
  item.stock = targetStock;
  item.status = targetStock === 0 ? 'OUT OF STOCK' : targetStock < item.minimum ? 'LOW STOCK' : 'NORMAL';
  await fs.writeFile(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
  const adjustments = JSON.parse(await fs.readFile(adjustmentsPath, 'utf8'));
  adjustments.unshift({ id: `ADJ-${Date.now()}`, inventoryId, name: item.name, stockBefore, physicalStock: targetStock, difference, reason: reason.trim(), createdAt: new Date().toISOString() });
  await fs.writeFile(adjustmentsPath, `${JSON.stringify(adjustments, null, 2)}\n`, 'utf8');
  return Response.json({ data: item, message: 'Penyesuaian stok berhasil disimpan.' }, { status: 201 });
}
