import { NextRequest, NextResponse } from 'next/server';

const ACCESS_COOKIE_NAME = 'tikvoice_access';

async function computeAccessToken(secret: string): Promise<string> {
  const data = new TextEncoder().encode(`tikvoice-gate:${secret}`);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function middleware(request: NextRequest) {
  const configuredKey = process.env.APP_ACCESS_KEY?.trim();
  if (!configuredKey) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (
    pathname === '/unlock' ||
    pathname === '/api/auth/unlock' ||
    pathname === '/api/health' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/music/') ||
    pathname.startsWith('/fonts/') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const headerKey = request.headers.get('x-access-key')?.trim();
  if (headerKey && headerKey === configuredKey) {
    return NextResponse.next();
  }

  const cookieToken = request.cookies.get(ACCESS_COOKIE_NAME)?.value;
  const expectedToken = await computeAccessToken(configuredKey);

  if (cookieToken && cookieToken === expectedToken) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { success: false, error: 'Chưa xác thực mã truy cập (APP_ACCESS_KEY).' },
      { status: 401 }
    );
  }

  const unlockUrl = request.nextUrl.clone();
  unlockUrl.pathname = '/unlock';
  unlockUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(unlockUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
