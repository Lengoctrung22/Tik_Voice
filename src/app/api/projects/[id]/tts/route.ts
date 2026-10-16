import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { connectDB } from '@/lib/db';
import { Project } from '@/lib/db/models/Project';
import { ttsEngine } from '@/lib/tts/engine';
import { getCategoryPath } from '@/lib/storage/local';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();

    const project = await Project.findById(id);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy dự án' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const textToSynthesize = (body.text || project.script?.text || '').trim();

    if (!textToSynthesize) {
      return NextResponse.json(
        { success: false, error: 'Kịch bản đang trống. Vui lòng viết hoặc tạo kịch bản trước.' },
        { status: 400 }
      );
    }

    const voice = body.voice || project.tts?.voice || 'vi-VN-HoaiMyNeural';
    const speed = typeof body.speed === 'number' ? body.speed : project.tts?.speed ?? 1.0;
    const pitch = typeof body.pitch === 'number' ? body.pitch : project.tts?.pitch ?? 0;
    const engine = body.engine || project.tts?.engine || 'edge';

    const audioDir = getCategoryPath('audio', id);
    const audioFileName = `speech_${Date.now()}.mp3`;
    const outputPath = path.join(audioDir, audioFileName);

    const result = await ttsEngine.synthesize(textToSynthesize, outputPath, {
      voice,
      speed,
      pitch,
      engine,
    });

    project.tts = {
      engine,
      voice,
      speed,
      pitch,
      audioPath: outputPath,
      audioDuration: result.audioDuration,
    };

    project.subtitle.words = result.words;
    if (project.status === 'draft' || project.status === 'scripted') {
      project.status = 'voiced';
    }

    await project.save();

    return NextResponse.json({
      success: true,
      data: {
        project,
        audioUrl: `/api/files/audio/${id}/${audioFileName}`,
        duration: result.audioDuration,
        words: result.words,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Tạo giọng đọc thất bại';
    console.error('Project TTS error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
