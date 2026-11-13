import { NextRequest, NextResponse } from 'next/server';

const ACCESS_COOKIE_NAME = 'tikvoice_access';

async function computeAccessToken(secret: string): Promise<string> {
  const data = new TextEncoder().encode(`tikvoice-gate:${secret}`);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function POST(request: NextRequest) {
  const configuredKey = process.env.APP_ACCESS_KEY?.trim();
  if (!configuredKey) {
    return NextResponse.json({ success: true, message: 'Hệ thống không yêu cầu mã khóa.' });
  }

  const body = (await request.json().catch(() => ({}))) as { key?: string };
  const submitted = typeof body.key === 'string' ? body.key.trim() : '';

  if (!submitted || submitted !== configuredKey) {
    return NextResponse.json(
      { success: false, error: 'Mã truy cập không chính xác.' },
      { status: 401 }
    );
  }

  const token = await computeAccessToken(configuredKey);
  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: ACCESS_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 ngày
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(ACCESS_COOKIE_NAME);
  return response;
}
