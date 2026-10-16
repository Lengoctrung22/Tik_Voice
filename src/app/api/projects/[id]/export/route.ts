import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { connectDB } from '@/lib/db';
import { Project } from '@/lib/db/models/Project';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();

    const project = await Project.findById(id);
    if (!project) {
      return new NextResponse('Không tìm thấy dự án', { status: 404 });
    }

    if (!project.export?.path || !fs.existsSync(project.export.path)) {
      return new NextResponse('Video chưa được render hoặc không tìm thấy tệp xuất', {
        status: 404,
      });
    }

    const stat = fs.statSync(project.export.path);
    const fileStream = fs.createReadStream(project.export.path);
    const safeName = encodeURIComponent(`${project.name || 'tikvoice'}.mp4`);

    return new NextResponse(fileStream as unknown as ReadableStream, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': stat.size.toString(),
        'Content-Disposition': `attachment; filename="${safeName}"; filename*=UTF-8''${safeName}`,
      },
    });
  } catch (error: unknown) {
    console.error('Export download error:', error);
    return new NextResponse('Lỗi tải video xuất', { status: 500 });
  }
}
