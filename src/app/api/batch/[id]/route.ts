import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { BatchGroup } from '@/lib/db/models/BatchGroup';
import { Project } from '@/lib/db/models/Project';
import { Job } from '@/lib/db/models/Job';
import { getVideoQueue } from '@/lib/queue/queues';
import { nanoid } from 'nanoid';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();

    const batch = await BatchGroup.findById(id).populate('items.projectId');
    if (!batch) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy lô batch' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: batch });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy thông tin lô batch';
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
      return NextResponse.json({ success: false, error: 'Không tìm thấy lô batch' }, { status: 404 });
    }

    batch.status = 'processing';
    await batch.save();

    const queue = getVideoQueue();

    // Queue projects in the batch sequentially
    for (const item of batch.items) {
      const project = await Project.findById(item.projectId);
      if (project && project.video?.path && project.tts?.audioPath) {
        const jobId = nanoid(12);
        await Job.create({
          _id: jobId,
          projectId: project._id,
          type: 'render',
          status: 'queued',
          progress: 0,
        });

        await queue.add('render-video', {
          jobId,
          projectId: project._id,
          quality: 'balanced',
        });

        item.status = 'processing';
      }
    }

    await batch.save();

    return NextResponse.json({
      success: true,
      message: 'Đã bắt đầu xử lý hàng loạt video trong lô',
      data: batch,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Bắt đầu xử lý lô thất bại';
    console.error('Start batch processing error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
