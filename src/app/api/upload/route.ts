import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import { connectDB } from '@/lib/db';
import { Project } from '@/lib/db/models/Project';
import { getCategoryPath } from '@/lib/storage/local';
import ffmpeg from 'fluent-ffmpeg';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const type = (formData.get('type') as string) || 'video';
    let projectId = (formData.get('projectId') as string) || '';

    if (!file) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy tệp tải lên' }, { status: 400 });
    }

    await connectDB();

    if (!projectId) {
      projectId = nanoid(12);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const originalName = file.name || 'uploaded_media';
    const cleanFileName = `${Date.now()}_${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    if (type === 'music') {
      const musicDir = getCategoryPath('music', projectId);
      const filePath = path.join(musicDir, cleanFileName);
      await fs.promises.writeFile(filePath, buffer);

      const project = await Project.findById(projectId);
      if (project) {
        project.bgMusic = {
          path: filePath,
          name: originalName,
          volume: 0.12,
          fadeIn: 2,
          fadeOut: 3,
        };
        await project.save();
      }

      return NextResponse.json({
        success: true,
        data: {
          projectId,
          path: filePath,
          fileName: originalName,
          fileSize: buffer.length,
          url: `/api/files/music/${projectId}/${cleanFileName}`,
        },
      });
    }

    // Default: Video upload
    const uploadDir = getCategoryPath('uploads', projectId);
    const filePath = path.join(uploadDir, cleanFileName);
    await fs.promises.writeFile(filePath, buffer);

    const metadata = await probeMedia(filePath);

    let project = await Project.findById(projectId);
    if (!project) {
      project = await Project.create({
        _id: projectId,
        name: originalName.replace(/\.[^/.]+$/, ''),
        status: 'draft',
        video: {
          path: filePath,
          fileName: originalName,
          duration: metadata.duration,
          width: metadata.width,
          height: metadata.height,
          fileSize: buffer.length,
        },
      });
    } else {
      project.video = {
        path: filePath,
        fileName: originalName,
        duration: metadata.duration,
        width: metadata.width,
        height: metadata.height,
        fileSize: buffer.length,
      };
      await project.save();
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

async function probeMedia(filePath: string) {
  return new Promise<{ duration: number; width: number; height: number }>((resolve) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err || !data) {
        return resolve({ duration: 30, width: 1080, height: 1920 });
      }
      const stream = data.streams?.find((s) => s.codec_type === 'video');
      const duration = Number(data.format?.duration) || 30;
      const width = stream?.width || 1080;
      const height = stream?.height || 1920;
      resolve({ duration: Math.round(duration * 100) / 100, width, height });
    });
  });
}
