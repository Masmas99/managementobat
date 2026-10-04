import { clearSessionCookie } from '@/lib/auth';

export async function POST() {
  const response = Response.json({ message: 'Anda berhasil keluar.' });
  response.headers.append('Set-Cookie', clearSessionCookie());
  return response;
}
