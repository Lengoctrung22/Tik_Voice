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

    const cfg =
      batch.sharedConfig && typeof batch.sharedConfig === 'object'
        ? (batch.sharedConfig as BatchSharedConfigShape)
        : {};
    const quality =
      cfg.quality === 'fast' || cfg.quality === 'high' || cfg.quality === 'balanced'
        ? cfg.quality
        : 'balanced';
    const resolution = parseResolution(cfg.resolution).key;

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
    let retriedCount = 0;

    for (const item of batch.items) {
      if (item.status !== 'error' && item.status !== 'pending') {
        continue;
      }

      const project = await Project.findById(item.projectId);
      if (!project || !project.video?.path) {
        item.status = 'error';
        item.error = !project ? 'Không tìm thấy dự án' : 'Dự án chưa có video gốc';
        continue;
      }

      const hasInput =
        Boolean(project.tts?.audioPath) ||
        Boolean(project.script?.text?.trim()) ||
        Boolean(project.script?.productName?.trim());

      if (!hasInput) {
        item.status = 'error';
        item.error = 'Thiếu kịch bản, giọng đọc hoặc tên sản phẩm';
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

        const bullJob = await queue.add(
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

        dbJob.bullmqJobId = bullJob.id;
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
        retriedCount++;
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

    if (retriedCount > 0) {
      batch.status = 'processing';
      batch.completedAt = undefined;
    }

    await batch.save();
    await batch.populate('items.projectId');

    return NextResponse.json({
      success: true,
      message:
        retriedCount > 0
          ? `Đã thử lại ${retriedCount} mục bị lỗi`
          : 'Không có mục lỗi nào để thử lại',
      data: batch,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Thử lại lô thất bại';
    console.error('Retry batch error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
