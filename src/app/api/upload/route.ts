import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { nanoid } from 'nanoid';
import { connectDB } from '@/lib/db';
import { Project, IVideoClip } from '@/lib/db/models/Project';
import { getCategoryPath, safeUnlinkStorageFile } from '@/lib/storage/local';
import { probeMedia, probeAudioDuration, generateVideoThumbnail } from '@/lib/video/probe';
import {
  validateUploadMetadata,
  MAX_VIDEO_UPLOAD_BYTES,
  MAX_AUDIO_UPLOAD_BYTES,
  MAX_IMAGE_UPLOAD_BYTES,
} from '@/lib/validation/schemas';

async function streamFileToDisk(
  file: File,
  destinationPath: string,
  maxBytes: number
): Promise<number> {
  const dir = path.dirname(destinationPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let totalBytes = 0;
  const webStream = file.stream();
  const reader = webStream.getReader();

  const nodeReadable = new Readable({
    async read() {
      try {
        const { done, value } = await reader.read();
        if (done) {
          this.push(null);
          return;
        }
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          const maxMb = Math.round(maxBytes / (1024 * 1024));
          this.destroy(new Error(`Tệp vượt quá giới hạn dung lượng ${maxMb}MB.`));
          return;
        }
        this.push(Buffer.from(value));
      } catch (err) {
        this.destroy(err instanceof Error ? err : new Error(String(err)));
      }
    },
  });

  const writeStream = fs.createWriteStream(destinationPath);
  try {
    await pipeline(nodeReadable, writeStream);
    return totalBytes;
  } catch (err) {
    await fs.promises.unlink(destinationPath).catch(() => {});
    throw err;
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const type = (formData.get('type') as string) || 'video';
    let projectId = (formData.get('projectId') as string) || '';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy tệp tải lên.' },
        { status: 400 }
      );
    }

    const validation = validateUploadMetadata(
      { name: file.name, type: file.type, size: file.size },
      type
    );
    if (!validation.ok) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: validation.status }
      );
    }

    await connectDB();

    if (!projectId) {
      projectId = nanoid(12);
    }

    const originalName = file.name || 'uploaded_media';
    const cleanFileName = `${Date.now()}_${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    // 1. Nhạc nền
    if (validation.category === 'music') {
      const musicDir = getCategoryPath('music', projectId);
      const filePath = path.join(musicDir, cleanFileName);
      const writtenBytes = await streamFileToDisk(file, filePath, MAX_AUDIO_UPLOAD_BYTES);

      const project = await Project.findById(projectId);
      if (project) {
        const oldMusic = project.bgMusic?.path;
        project.bgMusic = {
          path: filePath,
          name: originalName,
          volume: project.bgMusic?.volume ?? 0.12,
          fadeIn: project.bgMusic?.fadeIn ?? 2,
          fadeOut: project.bgMusic?.fadeOut ?? 3,
          ducking: project.bgMusic?.ducking ?? true,
        };
        await project.save();
        if (oldMusic && oldMusic !== filePath) {
          await safeUnlinkStorageFile(oldMusic);
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          projectId,
          path: filePath,
          fileName: originalName,
          fileSize: writtenBytes,
          url: `/api/files/music/${projectId}/${cleanFileName}`,
        },
      });
    }

    // 2. Giọng tự thu âm (Phase 3)
    if (validation.category === 'voice') {
      const audioDir = getCategoryPath('audio', projectId);
      const filePath = path.join(audioDir, `custom_voice_${cleanFileName}`);
      await streamFileToDisk(file, filePath, MAX_AUDIO_UPLOAD_BYTES);
      const audioDuration = await probeAudioDuration(filePath, 1);

      const project = await Project.findById(projectId);
      if (!project) {
        await safeUnlinkStorageFile(filePath);
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy dự án để gắn giọng đọc.' },
          { status: 404 }
        );
      }

      const oldAudio = project.tts?.audioPath;
      project.tts = {
        ...project.tts,
        engine: project.tts?.engine || 'edge',
        voice: 'Tự thu âm',
        speed: 1.0,
        pitch: 0,
        audioPath: filePath,
        audioDuration,
        sourceText: project.script?.text?.trim() || '',
        isCustomAudio: true,
      };

      // Căn chỉnh đều nhịp từ từ kịch bản hiện tại để phụ đề karaoke vẫn chạy khớp
      const scriptText = project.script?.text?.trim();
      if (scriptText) {
        const rawWords = scriptText.split(/\s+/).filter(Boolean);
        const totalChars = rawWords.reduce((sum, w) => sum + w.length, 0) || rawWords.length;
        const totalMs = Math.round(audioDuration * 1000);
        let cur = 0;
        project.subtitle.words = rawWords.map((w, idx) => {
          const dur = (w.length / totalChars) * totalMs;
          const start = Math.round(cur);
          const end = idx === rawWords.length - 1 ? totalMs : Math.max(start + 40, Math.round(cur + dur));
          cur = end;
          return { word: w, start, end };
        });
      }

      if (project.status === 'draft' || project.status === 'scripted') {
        project.status = 'voiced';
      }

      await project.save();
      if (oldAudio && oldAudio !== filePath) {
        await safeUnlinkStorageFile(oldAudio);
      }

      return NextResponse.json({
        success: true,
        data: {
          project,
          audioUrl: `/api/files/audio/${projectId}/${path.basename(filePath)}`,
          duration: audioDuration,
        },
      });
    }

    // 3. Logo / Watermark PNG (Phase 3)
    if (validation.category === 'watermark') {
      const uploadDir = getCategoryPath('uploads', projectId);
      const filePath = path.join(uploadDir, `wm_${cleanFileName}`);
      await streamFileToDisk(file, filePath, MAX_IMAGE_UPLOAD_BYTES);

      const project = await Project.findById(projectId);
      if (!project) {
        await safeUnlinkStorageFile(filePath);
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy dự án để gắn logo.' },
          { status: 404 }
        );
      }

      const oldWm = project.watermark?.path;
      project.watermark = {
        enabled: true,
        path: filePath,
        name: originalName,
        position: project.watermark?.position || 'top-right',
        opacity: project.watermark?.opacity ?? 0.85,
        scale: project.watermark?.scale ?? 0.16,
      };
      await project.save();

      if (oldWm && oldWm !== filePath) {
        await safeUnlinkStorageFile(oldWm);
      }

      return NextResponse.json({
        success: true,
        data: {
          project,
          watermarkUrl: `/api/files/uploads/${projectId}/${path.basename(filePath)}`,
        },
      });
    }

    // 4. Thêm B-roll clip phụ (Phase 2)
    if (validation.category === 'clip') {
      const uploadDir = getCategoryPath('uploads', projectId);
      const filePath = path.join(uploadDir, cleanFileName);
      const writtenBytes = await streamFileToDisk(file, filePath, MAX_VIDEO_UPLOAD_BYTES);
      const metadata = await probeMedia(filePath);

      const project = await Project.findById(projectId);
      if (!project) {
        await safeUnlinkStorageFile(filePath);
        return NextResponse.json(
          { success: false, error: 'Không tìm thấy dự án để thêm clip.' },
          { status: 404 }
        );
      }

      const existingClips: IVideoClip[] =
        project.video?.clips && project.video.clips.length > 0
          ? [...project.video.clips]
          : project.video?.path
          ? [
              {
                path: project.video.path,
                fileName: project.video.fileName,
                duration: project.video.duration,
                width: project.video.width,
                height: project.video.height,
                fileSize: project.video.fileSize,
                hasAudio: project.video.hasAudio,
              },
            ]
          : [];

      if (existingClips.length >= 5) {
        await safeUnlinkStorageFile(filePath);
        return NextResponse.json(
          { success: false, error: 'Mỗi dự án hỗ trợ tối đa 5 clip B-roll.' },
          { status: 400 }
        );
      }

      existingClips.push({
        path: filePath,
        fileName: originalName,
        duration: metadata.duration,
        width: metadata.width,
        height: metadata.height,
        fileSize: writtenBytes,
        hasAudio: metadata.hasAudio,
      });

      const totalClipDuration = existingClips.reduce((sum, c) => sum + c.duration, 0);
      if (!project.video?.path) {
        const thumbPath = path.join(uploadDir, `thumb_${Date.now()}.jpg`);
        const createdThumb = await generateVideoThumbnail(filePath, thumbPath, 0.5);
        project.video = {
          path: filePath,
          fileName: originalName,
          duration: Math.round(totalClipDuration * 100) / 100,
          width: metadata.width,
          height: metadata.height,
          fileSize: writtenBytes,
          hasAudio: metadata.hasAudio,
          aspectMode: 'contain',
          originalVolume: 0,
          thumbnailPath: createdThumb || undefined,
          clips: existingClips,
        };
      } else {
        project.video.clips = existingClips;
        project.video.duration = Math.round(totalClipDuration * 100) / 100;
        project.video.hasAudio = existingClips.some((c) => Boolean(c.hasAudio));
      }

      await project.save();
      return NextResponse.json({
        success: true,
        data: { project },
      });
    }

    // 5. Video gốc chính
    const uploadDir = getCategoryPath('uploads', projectId);
    const filePath = path.join(uploadDir, cleanFileName);
    const writtenBytes = await streamFileToDisk(file, filePath, MAX_VIDEO_UPLOAD_BYTES);

    const metadata = await probeMedia(filePath);
    const thumbFileName = `thumb_${Date.now()}.jpg`;
    const thumbPath = path.join(uploadDir, thumbFileName);
    const createdThumb = await generateVideoThumbnail(filePath, thumbPath, 0.5);

    const mainClip: IVideoClip = {
      path: filePath,
      fileName: originalName,
      duration: metadata.duration,
      width: metadata.width,
      height: metadata.height,
      fileSize: writtenBytes,
      hasAudio: metadata.hasAudio,
    };

    let project = await Project.findById(projectId);
    if (!project) {
      project = await Project.create({
        _id: projectId,
        name: originalName.replace(/\.[^/.]+$/, ''),
        status: 'draft',
        video: {
          ...mainClip,
          aspectMode: 'contain',
          originalVolume: 0,
          thumbnailPath: createdThumb || undefined,
          clips: [mainClip],
        },
      });
    } else {
      const oldVideo = project.video?.path;
      const oldThumb = project.video?.thumbnailPath;
      const oldClipPaths = (project.video?.clips || []).map((c) => c.path);
      project.video = {
        ...mainClip,
        aspectMode: project.video?.aspectMode || 'contain',
        originalVolume: project.video?.originalVolume ?? 0,
        thumbnailPath: createdThumb || undefined,
        clips: [mainClip],
      };
      await project.save();
      const pathsToCleanup = new Set<string>([
        ...(oldVideo ? [oldVideo] : []),
        ...oldClipPaths,
      ]);
      for (const p of pathsToCleanup) {
        if (p && p !== filePath) {
          await safeUnlinkStorageFile(p);
        }
      }
      if (oldThumb && oldThumb !== createdThumb) {
        await safeUnlinkStorageFile(oldThumb);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        project,
        url: `/api/files/uploads/${projectId}/${cleanFileName}`,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Tải lên tệp thất bại';
    console.error('Upload error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
