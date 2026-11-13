import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { connectDB } from '@/lib/db';
import { BatchGroup } from '@/lib/db/models/BatchGroup';
import { Project } from '@/lib/db/models/Project';
import { Job } from '@/lib/db/models/Job';
import { getVideoQueue } from '@/lib/queue/queues';
import { ensureRedisAvailable } from '@/lib/queue/connection';
import { parseResolution } from '@/lib/validation/schemas';

interface BatchSharedConfigShape {
  quality?: 'fast' | 'balanced' | 'high';
  resolution?: '1080x1920' | '720x1280';
}

function extractRenderSettings(sharedConfig: unknown): {
  quality: 'fast' | 'balanced' | 'high';
  resolution: '1080x1920' | '720x1280';
} {
  const cfg =
    sharedConfig && typeof sharedConfig === 'object'
      ? (sharedConfig as BatchSharedConfigShape)
      : {};
  const quality =
    cfg.quality === 'fast' || cfg.quality === 'high' || cfg.quality === 'balanced'
      ? cfg.quality
      : 'balanced';
  const resolution = parseResolution(cfg.resolution).key;
  return { quality, resolution };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();

    const batch = await BatchGroup.findById(id).populate('items.projectId');
    if (!batch) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy lô video' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: batch });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy thông tin lô video';
    console.error('Get batch error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();

    const batch = await BatchGroup.findById(id);
    if (!batch) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy lô video' }, { status: 404 });
    }

    const { quality, resolution } = extractRenderSettings(batch.sharedConfig);

    try {
      await ensureRedisAvailable(1500);
    } catch (redisErr: unknown) {
      return NextResponse.json(
        {
          success: false,
          error:
            redisErr instanceof Error
              ? redisErr.message
              : 'Hàng đợi xử lý nền (Redis) chưa sẵn sàng.',
        },
        { status: 503 }
      );
    }

    const queue = getVideoQueue();
    let queuedCount = 0;

    batch.status = 'processing';
    batch.completedAt = undefined;
    await batch.save();

    for (const item of batch.items) {
      const project = await Project.findById(item.projectId);

      if (!project) {
        item.status = 'error';
        item.error = 'Không tìm thấy dự án';
        continue;
      }

      if (!project.video?.path) {
        item.status = 'error';
        item.error = 'Dự án chưa có video gốc';
        continue;
      }

      const hasInputForPipeline =
        Boolean(project.tts?.audioPath) ||
        Boolean(project.script?.text?.trim()) ||
        Boolean(project.script?.productName?.trim());

      if (!hasInputForPipeline) {
        item.status = 'error';
        item.error = 'Cần có kịch bản, giọng đọc hoặc tên sản phẩm để AI tạo kịch bản';
        continue;
      }

      const existingActiveJob = await Job.findOne({
        projectId: project._id,
        type: { $in: ['render', 'full_pipeline'] },
        status: { $in: ['queued', 'processing'] },
      });

      if (existingActiveJob) {
        item.status = 'processing';
        item.error = undefined;
        queuedCount++;
        continue;
      }

      let createdJobId: string | null = null;
      try {
        const jobId = nanoid(12);
        createdJobId = jobId;
        const dbJob = await Job.create({
          _id: jobId,
          projectId: project._id,
          type: 'full_pipeline',
          status: 'queued',
          progress: 0,
          payload: { quality, resolution },
        });

        const bullmqJob = await queue.add(
          'full-pipeline-video',
          {
            jobId,
            projectId: project._id,
            type: 'full_pipeline',
            quality,
            resolution,
          },
          { jobId }
        );

        dbJob.bullmqJobId = bullmqJob.id;
        await dbJob.save();

        project.status = 'rendering';
        project.export = {
          path: project.export?.path || '',
          fileSize: project.export?.fileSize,
          resolution,
          quality,
          thumbnailPath: project.export?.thumbnailPath,
        };
        await project.save();

        item.status = 'processing';
        item.error = undefined;
        queuedCount++;
      } catch (queueErr: unknown) {
        if (createdJobId) {
          await Job.findByIdAndDelete(createdJobId).catch(() => {});
        }
        item.status = 'error';
        item.error =
          queueErr instanceof Error
            ? `Không thể đưa vào hàng đợi xử lý: ${queueErr.message}`
            : 'Lỗi đưa tác vụ vào hàng đợi xử lý nền (Redis)';
      }
    }

    if (queuedCount === 0) {
      batch.status = 'error';
      batch.completedAt = new Date();
    } else {
      batch.status = 'processing';
    }

    await batch.save();
    await batch.populate('items.projectId');

    return NextResponse.json({
      success: true,
      message:
        queuedCount > 0
          ? `Đã đưa ${queuedCount} video vào hàng đợi xử lý ngầm`
          : 'Không có video nào đủ điều kiện đưa vào hàng đợi',
      data: batch,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Bắt đầu xử lý lô thất bại';
    console.error('Start batch processing error:', error);
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

    const deleted = await BatchGroup.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy lô video' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Đã xóa lô xử lý hàng loạt',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Xóa lô video thất bại';
    console.error('Delete batch error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
