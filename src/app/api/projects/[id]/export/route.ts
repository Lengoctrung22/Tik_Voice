import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { connectDB } from '@/lib/db';
import { Project } from '@/lib/db/models/Project';

import { Readable } from 'stream';

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
    const webStream = Readable.toWeb(fileStream);
    const rawName = (project.name || 'tikvoice').trim();
    const asciiName = (rawName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'video') + '.mp4';
    const utf8Name = encodeURIComponent(rawName + '.mp4');

    return new NextResponse(webStream as unknown as ReadableStream, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': stat.size.toString(),
        'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
      },
    });
  } catch (error: unknown) {
    console.error('Export download error:', error);
    return new NextResponse('Lỗi tải video xuất', { status: 500 });
  }
}
