import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { connectDB } from '@/lib/db';
import { Project } from '@/lib/db/models/Project';

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim().toLowerCase();
    const statusFilter = searchParams.get('status') || 'all';
    const sort = searchParams.get('sort') || 'recent';

    const allProjects = await Project.find({}).sort({ updatedAt: -1 }).lean();

    const total = allProjects.length;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const today = allProjects.filter((p) => new Date(p.createdAt) >= startOfToday).length;
    const processing = allProjects.filter((p) => p.status === 'rendering').length;

    let filtered = allProjects;
    if (statusFilter && statusFilter !== 'all') {
      filtered = filtered.filter((p) => p.status === statusFilter);
    }
    if (q) {
      filtered = filtered.filter(
        (p) =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.script?.productName || '').toLowerCase().includes(q) ||
          (p.script?.text || '').toLowerCase().includes(q)
      );
    }
    if (sort === 'name') {
      filtered = [...filtered].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', 'vi')
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        projects: filtered,
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
    const body = (await request.json().catch(() => ({}))) as { name?: unknown };
    const rawName = typeof body.name === 'string' ? body.name.trim() : '';
    const name = rawName || `Dự án mới ${new Date().toLocaleDateString('vi-VN')}`;

    const project = await Project.create({
      _id: nanoid(12),
      name: name.slice(0, 150),
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
