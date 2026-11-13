import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import { connectDB } from '@/lib/db';
import { Project, IVideoClip } from '@/lib/db/models/Project';
import { getCategoryPath, getStorageBasePath } from '@/lib/storage/local';

async function copyStorageFileToNewProject(
  sourcePath: string | undefined,
  category: 'uploads' | 'audio' | 'subtitles' | 'music',
  newProjectId: string
): Promise<string | undefined> {
  if (!sourcePath || !fs.existsSync(sourcePath)) return undefined;
  const baseStorage = getStorageBasePath();
  const resolvedSource = path.resolve(sourcePath);
  // Nếu là tệp preset nằm trong public/music thì giữ nguyên đường dẫn chia sẻ
  if (!resolvedSource.startsWith(baseStorage)) {
    return sourcePath;
  }
  const destDir = getCategoryPath(category, newProjectId);
  const destPath = path.join(destDir, path.basename(resolvedSource));
  await fs.promises.copyFile(resolvedSource, destPath);
  return destPath;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();

    const source = await Project.findById(id).lean();
    if (!source) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy dự án gốc' }, { status: 404 });
    }

    const newId = nanoid(12);

    const newVideoPath = await copyStorageFileToNewProject(source.video?.path, 'uploads', newId);
    const newThumbPath = await copyStorageFileToNewProject(
      source.video?.thumbnailPath,
      'uploads',
      newId
    );

    const newClips: IVideoClip[] | undefined = source.video?.clips?.length
      ? await Promise.all(
          source.video.clips.map(async (clip) => {
            const copied = await copyStorageFileToNewProject(clip.path, 'uploads', newId);
            return {
              ...clip,
              path: copied || clip.path,
            };
          })
        )
      : undefined;

    const newAudioPath = await copyStorageFileToNewProject(source.tts?.audioPath, 'audio', newId);
    const newSubPath = await copyStorageFileToNewProject(
      source.subtitle?.path,
      'subtitles',
      newId
    );
    const newBgMusicPath = await copyStorageFileToNewProject(
      source.bgMusic?.path,
      'music',
      newId
    );
    const newWmPath = await copyStorageFileToNewProject(
      source.watermark?.path,
      'uploads',
      newId
    );

    let nextStatus: 'draft' | 'scripted' | 'voiced' | 'subtitled' = 'draft';
    if (newSubPath && source.subtitle?.words?.length) nextStatus = 'subtitled';
    else if (newAudioPath) nextStatus = 'voiced';
    else if (source.script?.text) nextStatus = 'scripted';

    const duplicated = await Project.create({
      _id: newId,
      name: `${source.name || 'Dự án'} (Bản sao)`,
      description: source.description,
      status: nextStatus,
      video: newVideoPath
        ? {
            ...source.video,
            path: newVideoPath,
            thumbnailPath: newThumbPath,
            clips: newClips,
          }
        : undefined,
      script: source.script ? { ...source.script } : undefined,
      tts: {
        ...source.tts,
        audioPath: newAudioPath,
      },
      subtitle: {
        ...source.subtitle,
        path: newSubPath,
      },
      bgMusic: source.bgMusic
        ? {
            ...source.bgMusic,
            path: newBgMusicPath || source.bgMusic.path,
          }
        : undefined,
      watermark: source.watermark
        ? {
            ...source.watermark,
            path: newWmPath || source.watermark.path,
          }
        : undefined,
      export: source.export
        ? {
            path: '',
            resolution: source.export.resolution || '1080x1920',
            quality: source.export.quality || 'balanced',
          }
        : undefined,
    });

    return NextResponse.json({
      success: true,
      data: duplicated,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Nhân bản dự án thất bại';
    console.error('Duplicate project error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
