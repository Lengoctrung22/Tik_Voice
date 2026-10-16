import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Job } from '@/lib/db/models/Job';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();

    const job = await Job.findById(id);
    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy tiến trình xử lý' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: job,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy thông tin job';
    console.error('Get job error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
