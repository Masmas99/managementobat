import { createHash } from 'node:crypto';
import { isDbConnectionError, isDbSchemaError, prisma, withDbRetry } from '@/lib/prisma';
import { SESSION_TTL_SECONDS, sessionCookie, signSession } from '@/lib/auth';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const email = body.email?.trim();
  const password = body.password || '';
  if (!email || !password) return Response.json({ error: 'Email dan password wajib diisi.' }, { status: 400 });

  let user;
  try {
    user = await withDbRetry(() => prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } }));
  } catch (error) {
    console.error('[auth/login] gagal mengambil pengguna:', error);
    if (isDbConnectionError(error)) {
      return Response.json({ error: 'Tidak dapat terhubung ke database. Coba lagi dalam beberapa detik.' }, { status: 503 });
    }
    if (isDbSchemaError(error)) {
      return Response.json({ error: 'Database belum siap. Jalankan migrasi database sebelum login.' }, { status: 503 });
    }
    return Response.json({ error: 'Terjadi kesalahan saat login. Coba lagi nanti.' }, { status: 500 });
  }

  const passwordHash = createHash('sha256').update(password).digest('hex');
  if (!user || user.status !== 'ACTIVE' || !user.passwordHash || user.passwordHash !== passwordHash) {
    return Response.json({ error: 'Email atau password salah.' }, { status: 401 });
  }

  try {
    await withDbRetry(() => prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } }));
  } catch (error) {
    console.error('[auth/login] gagal memperbarui lastLogin:', error);
  }

  const token = await signSession({
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  });

  const response = Response.json({
    data: { id: user.id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl },
    message: `Selamat datang, ${user.name}.`,
  });
  response.headers.append('Set-Cookie', sessionCookie(token));
  return response;
}
