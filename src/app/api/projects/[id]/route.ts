import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Project } from '@/lib/db/models/Project';
import { deleteProjectStorage } from '@/lib/storage/local';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();

    const project = await Project.findById(id);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy dự án' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: project,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy thông tin dự án';
    console.error('Get project error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();

    const updates = await request.json();
    const project = await Project.findByIdAndUpdate(id, { $set: updates }, { new: true });

    if (!project) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy dự án' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: project,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Cập nhật dự án thất bại';
    console.error('Patch project error:', error);
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

    const project = await Project.findById(id);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy dự án' }, { status: 404 });
    }

    // Xóa toàn bộ file vật lý liên quan trong storage
    await deleteProjectStorage(id);

    // Xóa record trong MongoDB
    await Project.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      message: 'Đã xóa dự án và dọn dẹp các tệp liên quan thành công',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Xóa dự án thất bại';
    console.error('Delete project error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
