import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { connectDB } from '@/lib/db';
import { Project } from '@/lib/db/models/Project';
import { Job } from '@/lib/db/models/Job';
import { deleteProjectStorage, getCategoryPath, safeUnlinkStorageFile } from '@/lib/storage/local';
import { generateVideoThumbnail } from '@/lib/video/probe';
import { projectPatchSchema } from '@/lib/validation/schemas';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();

    const project = await Project.findById(id);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy dự án' }, { status: 404 });
    }

    let activeJobId: string | null = null;
    if (project.status === 'rendering') {
      const activeJob = await Job.findOne({
        projectId: id,
        type: { $in: ['render', 'full_pipeline'] },
        status: { $in: ['queued', 'processing'] },
      }).sort({ createdAt: -1 });
      if (activeJob) {
        activeJobId = activeJob._id;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...project.toObject(),
        activeJobId,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy thông tin dự án';
    console.error('Get project error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Dữ liệu cập nhật không hợp lệ.' },
        { status: 400 }
      );
    }

    const parsed = projectPatchSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || 'Trường dữ liệu cập nhật không hợp lệ.',
        },
        { status: 400 }
      );
    }

    await connectDB();
    const project = await Project.findById(id);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy dự án' }, { status: 404 });
    }

    const updates = parsed.data;

    if (updates.name !== undefined) project.name = updates.name;
    if (updates.description !== undefined) project.description = updates.description;

    if (updates.video && project.video) {
      if (updates.video.aspectMode !== undefined) {
        project.video.aspectMode = updates.video.aspectMode;
      }
      if (updates.video.originalVolume !== undefined) {
        project.video.originalVolume = updates.video.originalVolume;
      }
      if (updates.video.clips !== undefined) {
        const prevPrimaryPath = project.video.path;
        const prevThumbPath = project.video.thumbnailPath;

        // Xóa tất cả các clip cũ không còn nằm trong danh sách mới (bao gồm cả clip 0 nếu bị gỡ)
        const nextPaths = new Set(updates.video.clips.map((c) => c.path));
        const candidateOldPaths = new Set<string>([
          ...(prevPrimaryPath ? [prevPrimaryPath] : []),
          ...(project.video.clips || []).map((c) => c.path),
        ]);
        for (const oldPath of candidateOldPaths) {
          if (oldPath && !nextPaths.has(oldPath)) {
            await safeUnlinkStorageFile(oldPath);
          }
        }

        project.video.clips = updates.video.clips;
        if (updates.video.clips.length > 0) {
          const primary = updates.video.clips[0];
          project.video.path = primary.path;
          project.video.fileName = primary.fileName;
          project.video.width = primary.width;
          project.video.height = primary.height;
          project.video.fileSize = primary.fileSize;
          project.video.hasAudio = updates.video.clips.some((c) => Boolean(c.hasAudio));
          project.video.duration =
            Math.round(updates.video.clips.reduce((s, c) => s + c.duration, 0) * 100) / 100;

          if (primary.path !== prevPrimaryPath) {
            const thumbPath = path.join(getCategoryPath('uploads', id), `thumb_${Date.now()}.jpg`);
            const createdThumb = await generateVideoThumbnail(primary.path, thumbPath, 0.5);
            if (createdThumb) {
              project.video.thumbnailPath = createdThumb;
              if (prevThumbPath && prevThumbPath !== createdThumb) {
                await safeUnlinkStorageFile(prevThumbPath);
              }
            }
          }
        }
      }
    }

    if (updates.script) {
      project.script = {
        text: project.script?.text || '',
        ...project.script,
        ...updates.script,
      };
      if (project.status === 'draft' && project.script.text?.trim()) {
        project.status = 'scripted';
      }
    }

    if (updates.tts) {
      project.tts = {
        ...project.tts,
        ...updates.tts,
      };
    }

    if (updates.subtitle) {
      if (updates.subtitle.enabled !== undefined) {
        project.subtitle.enabled = updates.subtitle.enabled;
      }
      if (updates.subtitle.style) {
        project.subtitle.style = {
          ...project.subtitle.style,
          ...updates.subtitle.style,
        };
      }
      if (updates.subtitle.words !== undefined) {
        project.subtitle.words = updates.subtitle.words;
      }
    }

    if (updates.bgMusic === null) {
      const oldMusic = project.bgMusic?.path;
      project.set('bgMusic', undefined);
      await safeUnlinkStorageFile(oldMusic);
    } else if (updates.bgMusic) {
      project.bgMusic = {
        volume: 0.12,
        fadeIn: 2,
        fadeOut: 3,
        ducking: true,
        ...project.bgMusic,
        ...updates.bgMusic,
      };
    }

    if (updates.watermark === null) {
      const oldWm = project.watermark?.path;
      project.set('watermark', undefined);
      await safeUnlinkStorageFile(oldWm);
    } else if (updates.watermark) {
      project.watermark = {
        enabled: false,
        position: 'top-right',
        opacity: 0.85,
        scale: 0.16,
        ...project.watermark,
        ...updates.watermark,
      };
    }

    if (updates.export) {
      project.export = {
        path: project.export?.path || '',
        resolution: updates.export.resolution || project.export?.resolution || '1080x1920',
        quality: updates.export.quality || project.export?.quality || 'balanced',
        fileSize: project.export?.fileSize,
        thumbnailPath: project.export?.thumbnailPath,
      };
    }

    await project.save();

    return NextResponse.json({
      success: true,
      data: project,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Cập nhật dự án thất bại';
    console.error('Patch project error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();

    const project = await Project.findById(id);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy dự án' }, { status: 404 });
    }

    await deleteProjectStorage(id);
    await Job.deleteMany({ projectId: id });

    const { BatchGroup } = await import('@/lib/db/models/BatchGroup');
    await BatchGroup.updateMany(
      { 'items.projectId': id },
      { $pull: { items: { projectId: id } } }
    );

    await Project.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      message: 'Đã xóa dự án và dọn dẹp các tệp liên quan thành công',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Xóa dự án thất bại';
    console.error('Delete project error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
