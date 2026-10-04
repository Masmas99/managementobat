import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';

function hashPassword(password) {
  return createHash('sha256').update(password).digest('hex');
}

const safeUser = { id: true, name: true, email: true, role: true, status: true, avatarUrl: true, lastLogin: true, createdAt: true };

export async function GET(request) {
  const { error } = await requirePermission(request, 'manageUsers');
  if (error) return error;
  const data = await prisma.user.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, email: true, role: true, status: true, avatarUrl: true, lastLogin: true, createdAt: true },
  });
  return Response.json({ data });
}

export async function POST(request) {
  const { session, error } = await requirePermission(request, 'manageUsers');
  if (error) return error;
  const { id, name, email, role, status = 'ACTIVE', password } = await request.json();
  if (!id || !name?.trim() || !email?.trim() || !role) return Response.json({ error: 'Nama, email, role, dan ID wajib diisi.' }, { status: 400 });
  if (!password || password.length < 8) return Response.json({ error: 'Password minimal 8 karakter.' }, { status: 400 });
  if (role === 'Super Admin' && session.role !== 'Super Admin') return Response.json({ error: 'Hanya Super Admin yang dapat membuat akun Super Admin.' }, { status: 403 });
  const data = await prisma.user.create({
    data: { id, name: name.trim(), email: email.trim(), role, status, ...(password ? { passwordHash: hashPassword(password) } : {}) },
    select: safeUser,
  });
  return Response.json({ data, message: 'Pengguna berhasil ditambahkan.' }, { status: 201 });
}

export async function PUT(request) {
  const { session, error } = await requirePermission(request, 'manageUsers');
  if (error) return error;
  const { id, name, email, role, status, password } = await request.json();
  if (!id || !name?.trim() || !email?.trim() || !role) return Response.json({ error: 'Data pengguna belum lengkap.' }, { status: 400 });
  if (password && password.length < 8) return Response.json({ error: 'Password minimal 8 karakter.' }, { status: 400 });
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return Response.json({ error: 'Pengguna tidak ditemukan.' }, { status: 404 });
  if ((role === 'Super Admin' || target.role === 'Super Admin') && session.role !== 'Super Admin') {
    return Response.json({ error: 'Hanya Super Admin yang dapat mengubah role Super Admin.' }, { status: 403 });
  }
  const data = await prisma.user.update({
    where: { id },
    data: { name: name.trim(), email: email.trim(), role, ...(status ? { status } : {}), ...(password ? { passwordHash: hashPassword(password) } : {}) },
    select: safeUser,
  });
  return Response.json({ data, message: 'Pengguna berhasil diperbarui.' });
}

export async function DELETE(request) {
  const { session, error } = await requirePermission(request, 'manageUsers');
  if (error) return error;
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return Response.json({ error: 'ID pengguna wajib diisi.' }, { status: 400 });
  if (id === session.sub) return Response.json({ error: 'Akun yang sedang login tidak boleh dihapus.' }, { status: 409 });
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return Response.json({ error: 'Pengguna tidak ditemukan.' }, { status: 404 });
  if (target.role === 'Super Admin' && session.role !== 'Super Admin') return Response.json({ error: 'Hanya Super Admin yang dapat menghapus akun Super Admin.' }, { status: 403 });
  const count = await prisma.user.count();
  if (count <= 1) return Response.json({ error: 'Pengguna terakhir tidak boleh dihapus.' }, { status: 409 });
  await prisma.user.delete({ where: { id } });
  return Response.json({ message: 'Pengguna berhasil dihapus.' });
}
