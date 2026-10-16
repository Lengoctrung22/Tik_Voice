import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { BatchGroup } from '@/lib/db/models/BatchGroup';
import { Project } from '@/lib/db/models/Project';
import archiver from 'archiver';
import { PassThrough } from 'stream';
import fs from 'fs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();

    const batch = await BatchGroup.findById(id);
    if (!batch) return new NextResponse('Batch not found', { status: 404 });

    const projectIds = batch.items.map((i: { projectId: string }) => i.projectId);
    const projects = await Project.find({ _id: { $in: projectIds }, status: 'done' });

    if (projects.length === 0) {
      return new NextResponse('Chưa có video nào trong lô hoàn thành để tải xuống', { status: 400 });
    }

    const archive = archiver('zip', { zlib: { level: 6 } });
    const stream = new PassThrough();

    archive.pipe(stream);

    for (const p of projects) {
      if (p.export?.path && fs.existsSync(p.export.path)) {
        const safeName = p.name ? p.name.replace(/[^a-zA-Z0-9_-]/g, '_') : 'video';
        const fileName = `${safeName}_${p._id}.mp4`;
        archive.file(p.export.path, { name: fileName });
      }
    }

    archive.finalize();

    return new NextResponse(stream as unknown as ReadableStream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="tikvoice-batch-${id}.zip"`,
      },
    });
  } catch (error: unknown) {
    console.error('Batch export error:', error);
    return new NextResponse('Lỗi tạo tệp ZIP xuất video', { status: 500 });
  }
}
