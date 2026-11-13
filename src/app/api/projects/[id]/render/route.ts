import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { connectDB } from '@/lib/db';
import { Project } from '@/lib/db/models/Project';
import { Job } from '@/lib/db/models/Job';
import { getVideoQueue } from '@/lib/queue/queues';
import { ensureRedisAvailable } from '@/lib/queue/connection';
import { renderRequestSchema } from '@/lib/validation/schemas';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rawBody = await request.json().catch(() => ({}));
    const parsed = renderRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || 'Tham số render không hợp lệ.',
        },
        { status: 400 }
      );
    }

    await connectDB();

    const project = await Project.findById(id);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy dự án' }, { status: 404 });
    }

    if (!project.video?.path) {
      return NextResponse.json(
        { success: false, error: 'Dự án chưa có video gốc. Vui lòng tải video lên trước.' },
        { status: 400 }
      );
    }

    if (!project.tts?.audioPath) {
      return NextResponse.json(
        { success: false, error: 'Dự án chưa có giọng đọc. Hãy tạo giọng đọc trước khi xuất.' },
        { status: 400 }
      );
    }

    // Chặn tạo job trùng nếu dự án đang render
    const existingActiveJob = await Job.findOne({
      projectId: id,
      type: { $in: ['render', 'full_pipeline'] },
      status: { $in: ['queued', 'processing'] },
    });

    if (project.status === 'rendering' && existingActiveJob) {
      return NextResponse.json(
        {
          success: false,
          error: 'Video này đang được render. Vui lòng đợi hoàn tất hoặc hủy tiến trình hiện tại.',
          data: { jobId: existingActiveJob._id },
        },
        { status: 409 }
      );
    }

    const { quality, resolution } = parsed.data;

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

    const jobId = nanoid(12);

    const dbJob = await Job.create({
      _id: jobId,
      projectId: id,
      type: 'render',
      status: 'queued',
      progress: 0,
      payload: { quality, resolution },
    });

    try {
      const queue = getVideoQueue();
      const bullJob = await queue.add(
        'render-video',
        {
          jobId,
          projectId: id,
          type: 'render',
          quality,
          resolution,
        },
        {
          jobId,
        }
      );

      dbJob.bullmqJobId = bullJob.id;
      await dbJob.save();
    } catch (queueErr: unknown) {
      await Job.findByIdAndDelete(jobId).catch(() => {});
      const message =
        queueErr instanceof Error
          ? `Không thể đưa vào hàng đợi xử lý: ${queueErr.message}`
          : 'Không thể kết nối hàng đợi xử lý nền (Redis)';
      return NextResponse.json({ success: false, error: message }, { status: 503 });
    }

    project.status = 'rendering';
    project.export = {
      path: project.export?.path || '',
      resolution,
      quality,
      fileSize: project.export?.fileSize,
      thumbnailPath: project.export?.thumbnailPath,
    };
    await project.save();

    return NextResponse.json({
      success: true,
      data: {
        jobId,
        status: 'queued',
        resolution,
        quality,
        project,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Kích hoạt render video thất bại';
    console.error('Trigger render error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
