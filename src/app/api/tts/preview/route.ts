import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { nanoid } from 'nanoid';
import { ttsEngine } from '@/lib/tts/engine';
import { getCategoryPath } from '@/lib/storage/local';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const voice = body.voice || 'vi-VN-HoaiMyNeural';
    const text = (body.text || 'Xin chào, đây là giọng đọc thử nghiệm trên TikVoice.').trim();
    const speed = typeof body.speed === 'number' ? body.speed : 1.0;
    const pitch = typeof body.pitch === 'number' ? body.pitch : 0;
    const engine = body.engine;

    const previewId = nanoid(8);
    const previewsDir = getCategoryPath('audio', 'previews');
    const fileName = `preview_${previewId}.mp3`;
    const outputPath = path.join(previewsDir, fileName);

    const result = await ttsEngine.synthesize(text, outputPath, {
      voice,
      speed,
      pitch,
      engine,
    });

    return NextResponse.json({
      success: true,
      data: {
        url: `/api/files/audio/previews/${fileName}`,
        duration: result.audioDuration,
        words: result.words,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Tạo giọng đọc thử nghiệm thất bại';
    console.error('TTS preview error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
