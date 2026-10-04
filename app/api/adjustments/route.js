import { promises as fs } from 'node:fs';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { serializeAdjustment, stockInclude, stockStatus } from '@/lib/inventory';

const inventoryPath = path.join(process.cwd(), 'data', 'inventory.json');
const adjustmentsPath = path.join(process.cwd(), 'data', 'adjustments.json');
const useDatabase = Boolean(process.env.DATABASE_URL);

export async function GET() {
  if (useDatabase) {
    try {
      const data = await prisma.stockAdjustment.findMany({ include: { batchStock: { include: stockInclude } }, orderBy: { createdAt: 'desc' } });
      return Response.json({ data: data.map(serializeAdjustment) });
    } catch {
      // Read-only adjustment views remain usable during a temporary database outage.
    }
  }
  return Response.json({ data: JSON.parse(await fs.readFile(adjustmentsPath, 'utf8')) });
}

export async function POST(request) {
  const { error } = await requirePermission(request, 'adjustStock');
  if (error) return error;
  const body = await request.json().catch(() => ({}));
  const batchStockId = body.batchStockId || body.inventoryId;
  const targetStock = Number(body.physicalStock);
  if (!batchStockId || !Number.isInteger(targetStock) || targetStock < 0 || !body.reason?.trim()) return Response.json({ error: 'Batch, stok fisik, dan alasan wajib diisi.' }, { status: 400 });

  if (useDatabase) {
    const item = await prisma.batchStock.findUnique({ where: { id: batchStockId }, include: stockInclude });
    if (!item) return Response.json({ error: 'Stok batch tidak ditemukan.' }, { status: 404 });
    const difference = targetStock - item.quantity;
    const saved = await prisma.$transaction(async (transaction) => {
      const savedItem = await transaction.batchStock.update({ where: { id: batchStockId }, data: { quantity: targetStock, status: stockStatus(targetStock, item.minimum) }, include: stockInclude });
      const savedAdjustment = await transaction.stockAdjustment.create({ data: { batchStockId, stockBefore: item.quantity, physicalStock: targetStock, difference, reason: body.reason.trim() } });
      return { savedItem, savedAdjustment };
    }, { timeout: 15000 });
    return Response.json({ data: serializeAdjustment({ ...saved.savedAdjustment, batchStock: saved.savedItem }), message: 'Penyesuaian stok berhasil disimpan.' }, { status: 201 });
  }

  const inventory = JSON.parse(await fs.readFile(inventoryPath, 'utf8'));
  const item = inventory.find((entry) => entry.id === batchStockId);
  if (!item) return Response.json({ error: 'Stok batch tidak ditemukan.' }, { status: 404 });
  const stockBefore = item.stock;
  const difference = targetStock - stockBefore;
  item.stock = targetStock;
  item.status = targetStock === 0 ? 'OUT OF STOCK' : targetStock < item.minimum ? 'LOW STOCK' : 'NORMAL';
  await fs.writeFile(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
  const adjustments = JSON.parse(await fs.readFile(adjustmentsPath, 'utf8'));
  adjustments.unshift({ id: `ADJ-${Date.now()}`, inventoryId: item.id, name: item.name, batch: item.batch, stockBefore, physicalStock: targetStock, difference, reason: body.reason.trim(), createdAt: new Date().toISOString() });
  await fs.writeFile(adjustmentsPath, `${JSON.stringify(adjustments, null, 2)}\n`, 'utf8');
  return Response.json({ data: item, message: 'Penyesuaian stok berhasil disimpan.' }, { status: 201 });
}
