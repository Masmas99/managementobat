import { promises as fs } from 'node:fs';
import path from 'node:path';
import { isDbConnectionError, prisma, withDbRetry } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';

const inventoryPath = path.join(process.cwd(), 'data', 'inventory.json');
const transactionsPath = path.join(process.cwd(), 'data', 'transactions.json');
const useDatabase = Boolean(process.env.DATABASE_URL);

function serializeItem(item) {
  return { ...item, nearestExpiry: item.nearestExpiry instanceof Date ? item.nearestExpiry.toISOString().slice(0, 10) : item.nearestExpiry };
}

async function readInventory() {
  const file = await fs.readFile(inventoryPath, 'utf8');
  return JSON.parse(file);
}

async function writeInventory(inventory) {
  await fs.writeFile(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
}

async function resolveMasterRelations({ supplier, category, location }) {
  const [supplierRef, categoryRef, locationRef] = await Promise.all([
    prisma.supplier.upsert({ where: { name: supplier }, update: {}, create: { id: `SUP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: supplier } }),
    prisma.medicineCategory.upsert({ where: { name: category }, update: {}, create: { id: `CAT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: category } }),
    prisma.storageLocation.upsert({ where: { name: location }, update: {}, create: { id: `LOC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: location } }),
  ]);
  return { supplierId: supplierRef.id, categoryId: categoryRef.id, locationId: locationRef.id };
}

export async function GET() {
  if (useDatabase) {
    try {
      const inventory = (await withDbRetry(() => prisma.inventoryItem.findMany({ orderBy: { id: 'asc' } }))).map(serializeItem);
      return Response.json({ data: inventory, meta: { total: inventory.length, generatedAt: new Date().toISOString() } });
    } catch (error) {
      console.error('[inventory] gagal membaca database, memakai data file:', isDbConnectionError(error) ? 'koneksi database bermasalah' : error);
    }
  }
  const inventory = await readInventory();
  return Response.json({ data: inventory, meta: { total: inventory.length, generatedAt: new Date().toISOString() } });
}

export async function POST(request) {
  const body = await request.json();
  const guard = await requirePermission(request, body.mode === 'create' ? 'manageInventory' : 'recordTransaction');
  if (guard.error) return guard.error;
  if (body.mode === 'create') {
    const { id, name, generic, category, batch, supplier, location, minimum, unitPrice, nearestExpiry } = body;
    if (!id || !name || !generic || !category || !batch || !supplier || !location || !nearestExpiry) return Response.json({ error: 'Data obat belum lengkap.' }, { status: 400 });
    if (useDatabase) {
      const relations = await resolveMasterRelations({ supplier, category, location });
      const created = await prisma.inventoryItem.create({ data: { id, name, generic, category, batch, supplier, location, ...relations, minimum: Number(minimum), unitPrice: Number(unitPrice), nearestExpiry: new Date(`${nearestExpiry}T00:00:00.000Z`), stock: 0, status: 'OUT OF STOCK' } });
      return Response.json({ data: serializeItem(created), message: 'Obat berhasil ditambahkan.' }, { status: 201 });
    }
    const inventory = await readInventory();
    inventory.push({ id, name, generic, category, batch, supplier, location, minimum: Number(minimum), unitPrice: Number(unitPrice), nearestExpiry, stock: 0, status: 'OUT OF STOCK' });
    await writeInventory(inventory);
    return Response.json({ data: inventory.at(-1), message: 'Obat berhasil ditambahkan.' }, { status: 201 });
  }
  const { inventoryId, type, quantity } = body;
  const amount = Number(quantity);
  if (useDatabase) {
    const item = await prisma.inventoryItem.findUnique({ where: { id: inventoryId } });
    if (!item || !['IN', 'OUT'].includes(type) || !Number.isInteger(amount) || amount <= 0) {
      return Response.json({ error: 'Data transaksi tidak valid.' }, { status: 400 });
    }
    if (type === 'OUT' && item.status === 'EXPIRED') {
      return Response.json({ error: 'Obat expired tidak boleh digunakan untuk stok keluar normal.' }, { status: 422 });
    }
    if (type === 'OUT' && item.stock < amount) {
      return Response.json({ error: 'Jumlah stok tidak mencukupi.' }, { status: 422 });
    }
    const stockAfter = item.stock + (type === 'IN' ? amount : -amount);
    const status = stockAfter === 0 ? 'OUT OF STOCK' : stockAfter < item.minimum ? 'LOW STOCK' : 'NORMAL';
    const updated = await prisma.$transaction(async (transaction) => {
      const saved = await transaction.inventoryItem.update({ where: { id: inventoryId }, data: { stock: stockAfter, status } });
      await transaction.stockTransaction.create({ data: { inventoryId, type, quantity: amount, stockBefore: item.stock, stockAfter } });
      return saved;
    });
    return Response.json({ data: serializeItem(updated), message: `Stok ${type === 'IN' ? 'masuk' : 'keluar'} berhasil dicatat.` }, { status: 201 });
  }

  const inventory = await readInventory();
  const item = inventory.find((entry) => entry.id === inventoryId);

  if (!item || !['IN', 'OUT'].includes(type) || !Number.isInteger(amount) || amount <= 0) {
    return Response.json({ error: 'Data transaksi tidak valid.' }, { status: 400 });
  }

  if (type === 'OUT' && item.status === 'EXPIRED') {
    return Response.json({ error: 'Obat expired tidak boleh digunakan untuk stok keluar normal.' }, { status: 422 });
  }

  if (type === 'OUT' && item.stock < amount) {
    return Response.json({ error: 'Jumlah stok tidak mencukupi.' }, { status: 422 });
  }

  item.stock += type === 'IN' ? amount : -amount;
  item.status = item.stock === 0 ? 'OUT OF STOCK' : item.stock < item.minimum ? 'LOW STOCK' : 'NORMAL';
  await writeInventory(inventory);
  const transactions = JSON.parse(await fs.readFile(transactionsPath, 'utf8'));
  transactions.unshift({ id: `TX-${Date.now()}`, type, quantity: amount, stockBefore: item.stock - (type === 'IN' ? amount : -amount), stockAfter: item.stock, createdAt: new Date().toISOString(), name: item.name, batch: item.batch });
  await fs.writeFile(transactionsPath, `${JSON.stringify(transactions, null, 2)}\n`, 'utf8');

  return Response.json({ data: item, message: `Stok ${type === 'IN' ? 'masuk' : 'keluar'} berhasil dicatat.` }, { status: 201 });
}

export async function PUT(request) {
  const { error } = await requirePermission(request, 'manageInventory');
  if (error) return error;
  const { id, ...changes } = await request.json();
  const allowed = ['name', 'generic', 'category', 'minimum', 'nearestExpiry', 'batch', 'supplier', 'location', 'unitPrice'];
  const data = Object.fromEntries(Object.entries(changes).filter(([key]) => allowed.includes(key)));
  if (!id || !data.name || !data.category || !data.batch || !data.nearestExpiry) return Response.json({ error: 'Data obat belum lengkap.' }, { status: 400 });

  if (useDatabase) {
    const relations = await resolveMasterRelations({ supplier: data.supplier, category: data.category, location: data.location });
    const updated = await prisma.inventoryItem.update({ where: { id }, data: { ...data, ...relations, minimum: Number(data.minimum), unitPrice: Number(data.unitPrice), nearestExpiry: new Date(`${data.nearestExpiry}T00:00:00.000Z`) } });
    return Response.json({ data: serializeItem(updated), message: 'Data obat berhasil diperbarui.' });
  }

  const inventory = await readInventory();
  const item = inventory.find((entry) => entry.id === id);
  if (!item) return Response.json({ error: 'Obat tidak ditemukan.' }, { status: 404 });
  Object.assign(item, data, { minimum: Number(data.minimum), unitPrice: Number(data.unitPrice) });
  await writeInventory(inventory);
  return Response.json({ data: item, message: 'Data obat berhasil diperbarui.' });
}

export async function DELETE(request) {
  const { error } = await requirePermission(request, 'manageInventory');
  if (error) return error;
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return Response.json({ error: 'ID obat wajib diisi.' }, { status: 400 });
  if (useDatabase) {
    await prisma.inventoryItem.delete({ where: { id } });
    return Response.json({ message: 'Obat berhasil dihapus.' });
  }
  const inventory = await readInventory();
  const nextInventory = inventory.filter((item) => item.id !== id);
  if (nextInventory.length === inventory.length) return Response.json({ error: 'Obat tidak ditemukan.' }, { status: 404 });
  await writeInventory(nextInventory);
  return Response.json({ message: 'Obat berhasil dihapus.' });
}
