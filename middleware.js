import { NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/auth';

export async function middleware(request) {
  const { pathname, search } = request.nextUrl;
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === '/login') {
    if (session) {
      const next = request.nextUrl.searchParams.get('next');
      return NextResponse.redirect(new URL(next?.startsWith('/') ? next : '/', request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/auth')) return NextResponse.next();

  if (!session) {
    if (pathname.startsWith('/api')) {
      return Response.json({ error: 'Anda belum login.' }, { status: 401 });
    }
    const url = new URL('/login', request.url);
    url.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)'],
};
