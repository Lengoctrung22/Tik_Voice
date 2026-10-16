import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { connectDB } from '@/lib/db';
import { Project } from '@/lib/db/models/Project';
import { Job } from '@/lib/db/models/Job';
import { getVideoQueue } from '@/lib/queue/queues';

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

    if (!project.video?.path) {
      return NextResponse.json(
        { success: false, error: 'Dự án chưa có video gốc. Vui lòng tải video lên trước.' },
        { status: 400 }
      );
    }

    if (!project.tts?.audioPath) {
      return NextResponse.json(
        { success: false, error: 'Dự án chưa có audio giọng đọc. Vui lòng tạo giọng đọc trước.' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const quality = body.quality || project.export?.quality || 'balanced';

    const jobId = nanoid(12);

    const dbJob = await Job.create({
      _id: jobId,
      projectId: id,
      type: 'render',
      status: 'queued',
      progress: 0,
    });

    const queue = getVideoQueue();
    const bullJob = await queue.add(
      'render-video',
      {
        jobId,
        projectId: id,
        quality,
      },
      {
        jobId,
      }
    );

    dbJob.bullmqJobId = bullJob.id;
    await dbJob.save();

    project.status = 'rendering';
    await project.save();

    return NextResponse.json({
      success: true,
      data: {
        jobId,
        status: 'queued',
        project,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Kích hoạt render video thất bại';
    console.error('Trigger render error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
