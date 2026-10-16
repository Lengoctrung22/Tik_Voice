import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { connectDB } from '@/lib/db';
import { Project } from '@/lib/db/models/Project';

export async function GET() {
  try {
    await connectDB();

    const projects = await Project.find({}).sort({ updatedAt: -1 }).lean();

    const total = projects.length;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const today = projects.filter((p) => new Date(p.createdAt) >= startOfToday).length;
    const processing = projects.filter(
      (p) => p.status === 'rendering' || p.status === 'voiced'
    ).length;

    return NextResponse.json({
      success: true,
      data: {
        projects,
        stats: {
          total,
          today,
          processing,
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy danh sách dự án';
    console.error('List projects error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json().catch(() => ({}));
    const name = body.name || `Dự án mới ${new Date().toLocaleDateString('vi-VN')}`;

    const project = await Project.create({
      _id: nanoid(12),
      name,
      status: 'draft',
    });

    return NextResponse.json({
      success: true,
      data: project,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Tạo dự án mới thất bại';
    console.error('Create project error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
