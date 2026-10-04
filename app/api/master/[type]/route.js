import { prisma, withDbRetry } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';

const models = {
  suppliers: { model: 'supplier', prefix: 'SUP', foreignKey: 'supplierId', textField: 'supplier' },
  categories: { model: 'medicineCategory', prefix: 'CAT', foreignKey: 'categoryId', textField: 'category' },
  locations: { model: 'storageLocation', prefix: 'LOC', foreignKey: 'locationId', textField: 'location' },
};

async function getConfig(type) {
  const config = models[type];
  if (!config) throw new Error('Master type tidak valid.');
  return config;
}

export async function GET(request, { params }) {
  const { type } = await params;
  const { model } = await getConfig(type);
  const data = await withDbRetry(() => prisma[model].findMany({ orderBy: { name: 'asc' }, include: { items: { select: { id: true } } } }));
  return Response.json({ data: data.map((item) => ({ ...item, itemCount: item.items.length, items: undefined })) });
}

export async function POST(request, { params }) {
  const { error } = await requirePermission(request, 'manageMaster');
  if (error) return error;
  const { type } = await params;
  const { model, prefix } = await getConfig(type);
  const { name } = await request.json();
  if (!name?.trim()) return Response.json({ error: 'Nama wajib diisi.' }, { status: 400 });
  const id = `${prefix}-${Date.now()}`;
  const data = await prisma[model].create({ data: { id, name: name.trim(), status: 'ACTIVE' } });
  return Response.json({ data, message: 'Data master berhasil ditambahkan.' }, { status: 201 });
}

export async function PUT(request, { params }) {
  const { error } = await requirePermission(request, 'manageMaster');
  if (error) return error;
  const { type } = await params;
  const { model, foreignKey, textField } = await getConfig(type);
  const { id, name, status } = await request.json();
  if (!id || !name?.trim()) return Response.json({ error: 'ID dan nama wajib diisi.' }, { status: 400 });
  const data = await prisma.$transaction(async (transaction) => {
    const updated = await transaction[model].update({ where: { id }, data: { name: name.trim(), ...(status ? { status } : {}) } });
    await transaction.inventoryItem.updateMany({ where: { [foreignKey]: id }, data: { [textField]: name.trim() } });
    return updated;
  });
  return Response.json({ data, message: 'Data master berhasil diperbarui.' });
}

export async function DELETE(request, { params }) {
  const { error } = await requirePermission(request, 'manageMaster');
  if (error) return error;
  const { type } = await params;
  const { model } = await getConfig(type);
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return Response.json({ error: 'ID wajib diisi.' }, { status: 400 });
  const usage = await prisma.inventoryItem.count({ where: type === 'suppliers' ? { supplierId: id } : type === 'categories' ? { categoryId: id } : { locationId: id } });
  if (usage > 0) return Response.json({ error: `Data masih digunakan oleh ${usage} obat. Edit obat terlebih dahulu sebelum menghapus.` }, { status: 409 });
  await prisma[model].delete({ where: { id } });
  return Response.json({ message: 'Data master berhasil dihapus.' });
}
