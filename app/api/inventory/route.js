import { promises as fs } from 'node:fs';
import path from 'node:path';
import { prisma, isDbConnectionError, withDbRetry } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { makeBatchId, makeStockId, serializeStock, stockInclude, stockStatus } from '@/lib/inventory';

const inventoryPath = path.join(process.cwd(), 'data', 'inventory.json');
const transactionsPath = path.join(process.cwd(), 'data', 'transactions.json');
const useDatabase = Boolean(process.env.DATABASE_URL);

async function readInventory() {
  return JSON.parse(await fs.readFile(inventoryPath, 'utf8'));
}

async function writeInventory(inventory) {
  await fs.writeFile(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
}

async function resolveMasters({ supplier, category, location }) {
  const [supplierRef, categoryRef, locationRef] = await Promise.all([
    prisma.supplier.upsert({ where: { name: supplier }, update: {}, create: { id: `SUP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: supplier } }),
    prisma.medicineCategory.upsert({ where: { name: category }, update: {}, create: { id: `CAT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: category } }),
    prisma.storageLocation.upsert({ where: { name: location }, update: {}, create: { id: `LOC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: location } }),
  ]);
  return { supplierRef, categoryRef, locationRef };
}

function validateMedicine(body) {
  const required = ['name', 'generic', 'category', 'batch', 'supplier', 'location', 'nearestExpiry'];
  if (!body.id || required.some((field) => !body[field]?.toString().trim())) return 'Data obat belum lengkap.';
  if (!Number.isInteger(Number(body.minimum)) || Number(body.minimum) < 0 || !Number.isInteger(Number(body.unitPrice)) || Number(body.unitPrice) < 0) return 'Minimum stok dan harga harus berupa angka positif.';
  return null;
}

export async function GET() {
  if (useDatabase) {
    try {
      const stocks = await withDbRetry(() => prisma.batchStock.findMany({ orderBy: { id: 'asc' }, include: stockInclude }));
      return Response.json({ data: stocks.map(serializeStock), meta: { total: stocks.length, generatedAt: new Date().toISOString() } });
    } catch (error) {
      console.error('[inventory] database fallback:', isDbConnectionError(error) ? 'koneksi bermasalah' : error);
    }
  }
  const inventory = await readInventory();
  return Response.json({ data: inventory, meta: { total: inventory.length, generatedAt: new Date().toISOString() } });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const isBatch = body.mode === 'batch';
  const guard = await requirePermission(request, isBatch || body.mode === 'create' ? 'manageInventory' : 'recordTransaction');
  if (guard.error) return guard.error;

  if (isBatch || body.mode === 'create') {
    const error = validateMedicine(body);
    if (error) return Response.json({ error }, { status: 400 });
    const productId = isBatch ? body.productId : body.id;
    if (!productId) return Response.json({ error: 'Obat induk wajib dipilih.' }, { status: 400 });

    if (useDatabase) {
      const result = await prisma.$transaction(async (transaction) => {
        const masters = await resolveMasters(body);
        let product;
          if (isBatch) {
          product = await transaction.medicineProduct.findUnique({ where: { id: productId } });
          if (!product) throw new Error('PRODUCT_NOT_FOUND');
        } else {
          product = await transaction.medicineProduct.create({
            data: {
              id: body.id,
              name: body.name.trim(),
              genericName: body.generic.trim(),
              category: body.category.trim(),
              categoryId: masters.categoryRef.id,
              strength: body.strength?.trim() || null,
              dosageForm: body.dosageForm?.trim() || null,
              route: body.route?.trim() || null,
              gtin: body.gtin?.trim() || null,
              registrationNo: body.registrationNo?.trim() || null,
              manufacturer: body.manufacturer?.trim() || null,
            },
          });
        }
        const batchId = makeBatchId(product.id, body.batch.trim());
        const stockId = isBatch ? body.id : body.id;
        const batch = await transaction.medicineBatch.create({
          data: {
              id: batchId,
            productId: product.id,
            batchNumber: body.batch.trim(),
            manufacturedAt: body.manufacturedAt ? new Date(`${body.manufacturedAt}T00:00:00.000Z`) : null,
            expiryDate: new Date(`${body.nearestExpiry}T00:00:00.000Z`),
            supplierId: masters.supplierRef.id,
            manufacturer: body.manufacturer?.trim() || product.manufacturer || null,
          },
        });
        const stock = await transaction.batchStock.create({
          data: {
            id: stockId,
            batchId: batch.id,
              locationId: masters.locationRef.id,
            quantity: 0,
            minimum: Number(body.minimum),
            unitPrice: Number(body.unitPrice),
            status: 'OUT_OF_STOCK',
          },
          include: stockInclude,
        });
        return stock;
        }, { timeout: 15000 });
      return Response.json({ data: serializeStock(result), message: isBatch ? 'Batch berhasil ditambahkan.' : 'Obat berhasil ditambahkan.' }, { status: 201 });
    }

    const inventory = await readInventory();
    if (inventory.some((item) => item.id === body.id)) return Response.json({ error: 'Kode stok sudah digunakan.' }, { status: 409 });
    const parent = isBatch ? inventory.find((item) => item.productId === productId || item.id === productId) : null;
    if (isBatch && !parent) return Response.json({ error: 'Obat induk tidak ditemukan.' }, { status: 404 });
    const item = {
      id: body.id,
      productId: parent?.productId || body.id,
      name: parent?.name || body.name.trim(),
      generic: parent?.generic || body.generic.trim(),
      strength: parent?.strength || body.strength?.trim() || '',
      dosageForm: parent?.dosageForm || body.dosageForm?.trim() || '',
      route: parent?.route || body.route?.trim() || '',
      gtin: parent?.gtin || body.gtin?.trim() || '',
      registrationNo: parent?.registrationNo || body.registrationNo?.trim() || '',
      manufacturer: parent?.manufacturer || body.manufacturer?.trim() || '',
      category: parent?.category || body.category.trim(),
      batch: body.batch.trim(),
      supplier: body.supplier.trim(),
      location: body.location.trim(),
      minimum: Number(body.minimum),
      unitPrice: Number(body.unitPrice),
      nearestExpiry: body.nearestExpiry,
      stock: 0,
      status: 'OUT OF STOCK',
    };
    inventory.push(item);
    await writeInventory(inventory);
    return Response.json({ data: item, message: isBatch ? 'Batch berhasil ditambahkan.' : 'Obat berhasil ditambahkan.' }, { status: 201 });
  }

  const { inventoryId, batchStockId = inventoryId, type, quantity } = body;
  const amount = Number(quantity);
  if (useDatabase) {
    const item = await prisma.batchStock.findUnique({ where: { id: batchStockId }, include: stockInclude });
    if (!item || !['IN', 'OUT'].includes(type) || !Number.isInteger(amount) || amount <= 0) return Response.json({ error: 'Data transaksi tidak valid.' }, { status: 400 });
    const current = serializeStock(item);
    if (type === 'OUT' && (current.batchStatus !== 'RELEASED' || new Date(item.batch.expiryDate).getTime() <= Date.now())) return Response.json({ error: 'Batch tidak dapat digunakan untuk stok keluar.' }, { status: 422 });
    if (type === 'OUT' && item.quantity < amount) return Response.json({ error: 'Jumlah stok tidak mencukupi.' }, { status: 422 });
    const stockAfter = item.quantity + (type === 'IN' ? amount : -amount);
    const updated = await prisma.$transaction(async (transaction) => {
      const saved = await transaction.batchStock.update({ where: { id: batchStockId }, data: { quantity: stockAfter, status: stockStatus(stockAfter, item.minimum) }, include: stockInclude });
      await transaction.stockTransaction.create({ data: { batchStockId, type, quantity: amount, stockBefore: item.quantity, stockAfter } });
      return saved;
    }, { timeout: 15000 });
    return Response.json({ data: serializeStock(updated), message: `Stok ${type === 'IN' ? 'masuk' : 'keluar'} berhasil dicatat.` }, { status: 201 });
  }

  const inventory = await readInventory();
  const item = inventory.find((entry) => entry.id === inventoryId);
  if (!item || !['IN', 'OUT'].includes(type) || !Number.isInteger(amount) || amount <= 0) return Response.json({ error: 'Data transaksi tidak valid.' }, { status: 400 });
  if (type === 'OUT' && item.status === 'EXPIRED') return Response.json({ error: 'Obat expired tidak boleh digunakan untuk stok keluar normal.' }, { status: 422 });
  if (type === 'OUT' && item.stock < amount) return Response.json({ error: 'Jumlah stok tidak mencukupi.' }, { status: 422 });
  const stockBefore = item.stock;
  item.stock += type === 'IN' ? amount : -amount;
  item.status = item.stock === 0 ? 'OUT OF STOCK' : item.stock < item.minimum ? 'LOW STOCK' : 'NORMAL';
  await writeInventory(inventory);
  const transactions = JSON.parse(await fs.readFile(transactionsPath, 'utf8'));
  transactions.unshift({ id: `TX-${Date.now()}`, inventoryId: item.id, type, quantity: amount, stockBefore, stockAfter: item.stock, createdAt: new Date().toISOString(), name: item.name, batch: item.batch });
  await fs.writeFile(transactionsPath, `${JSON.stringify(transactions, null, 2)}\n`, 'utf8');
  return Response.json({ data: item, message: `Stok ${type === 'IN' ? 'masuk' : 'keluar'} berhasil dicatat.` }, { status: 201 });
}

export async function PUT(request) {
  const { error } = await requirePermission(request, 'manageInventory');
  if (error) return error;
  const { id, ...changes } = await request.json();
  if (!id) return Response.json({ error: 'ID stok wajib diisi.' }, { status: 400 });
  const minimum = Number(changes.minimum);
  const unitPrice = Number(changes.unitPrice);
  if (!changes.name?.trim() || !changes.generic?.trim() || !changes.category?.trim() || !changes.batch?.trim() || !changes.supplier?.trim() || !changes.location?.trim() || !changes.nearestExpiry || !Number.isInteger(minimum) || minimum < 0 || !Number.isInteger(unitPrice) || unitPrice < 0) return Response.json({ error: 'Data obat/batch belum lengkap atau tidak valid.' }, { status: 400 });
  if (useDatabase) {
    const current = await prisma.batchStock.findUnique({ where: { id }, include: stockInclude });
    if (!current) return Response.json({ error: 'Stok batch tidak ditemukan.' }, { status: 404 });
    const masters = await resolveMasters(changes);
    const updated = await prisma.$transaction(async (transaction) => {
      await transaction.medicineProduct.update({ where: { id: current.batch.product.id }, data: { name: changes.name.trim(), genericName: changes.generic.trim(), category: changes.category.trim(), categoryId: masters.categoryRef.id, strength: changes.strength?.trim() || null, dosageForm: changes.dosageForm?.trim() || null, route: changes.route?.trim() || null, gtin: changes.gtin?.trim() || null, registrationNo: changes.registrationNo?.trim() || null, manufacturer: changes.manufacturer?.trim() || null } });
      await transaction.medicineBatch.update({ where: { id: current.batchId }, data: { batchNumber: changes.batch.trim(), expiryDate: new Date(`${changes.nearestExpiry}T00:00:00.000Z`), supplierId: masters.supplierRef.id, manufacturer: changes.manufacturer?.trim() || null } });
      return transaction.batchStock.update({ where: { id }, data: { locationId: masters.locationRef.id, minimum, unitPrice }, include: stockInclude });
    }, { timeout: 15000 });
    return Response.json({ data: serializeStock(updated), message: 'Data obat dan batch berhasil diperbarui.' });
  }
  const inventory = await readInventory();
  const item = inventory.find((entry) => entry.id === id);
  if (!item) return Response.json({ error: 'Stok batch tidak ditemukan.' }, { status: 404 });
  Object.assign(item, changes, { minimum, unitPrice });
  await writeInventory(inventory);
  return Response.json({ data: item, message: 'Data obat dan batch berhasil diperbarui.' });
}

export async function DELETE(request) {
  const { error } = await requirePermission(request, 'manageInventory');
  if (error) return error;
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return Response.json({ error: 'ID stok wajib diisi.' }, { status: 400 });
  if (useDatabase) {
    const result = await prisma.batchStock.deleteMany({ where: { id } });
    if (!result.count) return Response.json({ error: 'Stok batch tidak ditemukan.' }, { status: 404 });
    return Response.json({ message: 'Stok batch berhasil dihapus.' });
  }
  const inventory = await readInventory();
  const nextInventory = inventory.filter((item) => item.id !== id);
  if (nextInventory.length === inventory.length) return Response.json({ error: 'Stok batch tidak ditemukan.' }, { status: 404 });
  await writeInventory(nextInventory);
  return Response.json({ message: 'Stok batch berhasil dihapus.' });
}
