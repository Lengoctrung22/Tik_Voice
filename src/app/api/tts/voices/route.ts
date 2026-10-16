import { NextResponse } from 'next/server';
import { SUPPORTED_VOICES } from '@/lib/tts/voices';

export async function GET() {
  return NextResponse.json({
    success: true,
    data: SUPPORTED_VOICES,
  });
}
