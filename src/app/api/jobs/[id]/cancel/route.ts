import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { connectDB } from '@/lib/db';
import { Job } from '@/lib/db/models/Job';
import { Project } from '@/lib/db/models/Project';
import { getVideoQueue } from '@/lib/queue/queues';
import { createFastFailRedisClient } from '@/lib/queue/connection';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();

    const job = await Job.findById(id);
    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy tiến trình cần hủy.' },
        { status: 404 }
      );
    }

    if (job.status === 'done' || job.status === 'error' || job.status === 'cancelled') {
      return NextResponse.json(
        { success: false, error: 'Tiến trình này đã kết thúc, không thể hủy.' },
        { status: 400 }
      );
    }

    job.status = 'cancelled';
    job.cancelledAt = new Date();
    await job.save();

    // Đánh dấu cờ hủy trên Redis để worker đang chạy FFmpeg dừng ngay (bỏ qua mượt nếu Redis đang tắt)
    const redis = createFastFailRedisClient(1200);
    try {
      await Promise.race([
        (async () => {
          await redis.connect();
          await redis.set(`tikvoice:cancel:${id}`, '1', 'EX', 300);
          if (job.bullmqJobId) {
            const queue = getVideoQueue();
            const bullJob = await queue.getJob(job.bullmqJobId);
            if (bullJob) {
              const state = await bullJob.getState();
              if (state === 'waiting' || state === 'delayed') {
                await bullJob.remove().catch(() => {});
              }
            }
          }
        })(),
        new Promise<void>((resolve) => setTimeout(resolve, 1500)),
      ]);
    } catch {
      // vẫn hủy trạng thái DB kể cả khi Redis offline
    } finally {
      redis.disconnect();
    }

    const project = await Project.findById(job.projectId);
    if (project && project.status === 'rendering') {
      if (project.export?.path && fs.existsSync(project.export.path)) {
        project.status = 'done';
      } else if (project.subtitle?.words?.length > 0) {
        project.status = 'subtitled';
      } else if (project.tts?.audioPath) {
        project.status = 'voiced';
      } else if (project.script?.text) {
        project.status = 'scripted';
      } else {
        project.status = 'draft';
      }
      await project.save();
    }

    return NextResponse.json({
      success: true,
      message: 'Đã hủy tác vụ render thành công.',
      data: { job, project },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Hủy tác vụ thất bại';
    console.error('Cancel job error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
