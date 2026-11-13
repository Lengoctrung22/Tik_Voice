import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { ttsEngine } from '@/lib/tts/engine';
import { cleanupPreviewCache, getCategoryPath } from '@/lib/storage/local';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      voice?: string;
      text?: string;
      speed?: number;
      pitch?: number;
      engine?: 'edge' | 'google';
      applyPronunciation?: boolean;
    };

    const voice = body.voice || 'vi-VN-HoaiMyNeural';
    const text = (body.text || 'Xin chào, đây là giọng đọc thử nghiệm trên TikVoice.').trim().slice(0, 300);
    const speed = typeof body.speed === 'number' ? body.speed : 1.0;
    const pitch = typeof body.pitch === 'number' ? body.pitch : 0;
    const engine = body.engine;
    const applyPronunciation = body.applyPronunciation ?? true;

    const hash = crypto
      .createHash('sha1')
      .update(JSON.stringify({ voice, text, speed, pitch, engine, applyPronunciation }))
      .digest('hex')
      .slice(0, 16);

    const previewsDir = getCategoryPath('audio', 'previews');
    const fileName = `preview_${hash}.mp3`;
    const outputPath = path.join(previewsDir, fileName);

    if (fs.existsSync(outputPath)) {
      const stat = fs.statSync(outputPath);
      if (stat.size > 0) {
        return NextResponse.json({
          success: true,
          data: {
            url: `/api/files/audio/previews/${fileName}`,
            cached: true,
          },
        });
      }
    }

    const result = await ttsEngine.synthesize(text, outputPath, {
      voice,
      speed,
      pitch,
      engine,
      applyPronunciation,
    });

    // Dọn dẹp cache cũ không chặn phản hồi
    cleanupPreviewCache().catch(() => {});

    return NextResponse.json({
      success: true,
      data: {
        url: `/api/files/audio/previews/${fileName}`,
        duration: result.audioDuration,
        words: result.words,
        cached: false,
        fallbackFrom: result.fallbackFrom,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Tạo giọng đọc thử nghiệm thất bại';
    console.error('TTS preview error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
