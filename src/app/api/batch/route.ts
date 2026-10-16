import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { connectDB } from '@/lib/db';
import { BatchGroup } from '@/lib/db/models/BatchGroup';

export async function GET() {
  try {
    await connectDB();
    const batches = await BatchGroup.find({}).sort({ updatedAt: -1 }).populate('items.projectId');
    return NextResponse.json({ success: true, data: batches });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy danh sách lô batch';
    console.error('List batch error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const { name, projectIds = [], sharedConfig } = body;

    const batch = await BatchGroup.create({
      _id: nanoid(12),
      name: name || `Lô video ${new Date().toLocaleDateString('vi-VN')}`,
      status: 'pending',
      items: projectIds.map((pid: string, idx: number) => ({
        projectId: pid,
        order: idx,
        status: 'pending',
      })),
      sharedConfig,
    });

    return NextResponse.json({ success: true, data: batch });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Tạo lô batch thất bại';
    console.error('Create batch error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
