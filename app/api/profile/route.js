import { createHash } from 'node:crypto';
import { isDbConnectionError, prisma, withDbRetry } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(request) {
  const session = await getSession(request);
  if (!session) return Response.json({ error: 'Anda belum login.' }, { status: 401 });
  try {
    const user = await withDbRetry(() => prisma.user.findUnique({ where: { id: session.sub }, select: { id: true, name: true, email: true, role: true, avatarUrl: true } }));
    if (!user) return Response.json({ error: 'Profil tidak ditemukan.' }, { status: 404 });
    return Response.json({ data: user });
  } catch (error) {
    console.error('[profile] gagal membaca profil:', error);
    if (isDbConnectionError(error)) return Response.json({ error: 'Tidak dapat terhubung ke database. Muat ulang halaman.' }, { status: 503 });
    return Response.json({ error: 'Profil gagal dimuat.' }, { status: 500 });
  }
}

export async function PUT(request) {
  const session = await getSession(request);
  if (!session) return Response.json({ error: 'Anda belum login.' }, { status: 401 });
  const { name, avatarUrl, currentPassword, newPassword } = await request.json();
  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user) return Response.json({ error: 'Profil tidak ditemukan.' }, { status: 404 });
  const data = {};
  if (name?.trim()) data.name = name.trim();
  if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;
  if (newPassword) {
    if (!currentPassword || createHash('sha256').update(currentPassword).digest('hex') !== user.passwordHash) return Response.json({ error: 'Password saat ini salah.' }, { status: 422 });
    if (newPassword.length < 8) return Response.json({ error: 'Password baru minimal 8 karakter.' }, { status: 422 });
    data.passwordHash = createHash('sha256').update(newPassword).digest('hex');
  }
  const updated = await prisma.user.update({ where: { id: user.id }, data, select: { id: true, name: true, email: true, role: true, avatarUrl: true } });
  return Response.json({ data: updated, message: 'Profil berhasil diperbarui.' });
}
