import { isDbConnectionError, prisma, withDbRetry } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(request) {
  const session = await getSession(request);
  if (!session) return Response.json({ error: 'Anda belum login.' }, { status: 401 });

  let user = null;
  let connectionError = null;
  try {
    user = await withDbRetry(() =>
      prisma.user.findUnique({
        where: { id: session.sub },
        select: { id: true, name: true, email: true, role: true, status: true, avatarUrl: true },
      }),
    );
  } catch (error) {
    connectionError = error;
    console.error('[auth/me] gagal mengambil pengguna:', error);
  }

  if (!user) {
    if (connectionError && isDbConnectionError(connectionError)) {
      return Response.json({ error: 'Tidak dapat terhubung ke database. Muat ulang halaman.' }, { status: 503 });
    }
    return Response.json({ error: 'Akun tidak ditemukan.' }, { status: 401 });
  }

  if (user.status !== 'ACTIVE') return Response.json({ error: 'Akun tidak aktif.' }, { status: 401 });
  return Response.json({ data: user });
}
