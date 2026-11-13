import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { connectDB } from '@/lib/db';
import { Project } from '@/lib/db/models/Project';
import { generateAssFile } from '@/lib/video/subtitle';
import { getCategoryPath, safeUnlinkStorageFile } from '@/lib/storage/local';
import { subtitleUpdateSchema } from '@/lib/validation/schemas';

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

    const assContent = generateAssFile(project.subtitle.words, project.subtitle.style);

    return NextResponse.json({
      success: true,
      data: {
        subtitle: project.subtitle,
        assContent,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy thông tin phụ đề';
    console.error('Get subtitle error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Dữ liệu cấu hình phụ đề không hợp lệ.' },
        { status: 400 }
      );
    }

    const parsed = subtitleUpdateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || 'Thông số phụ đề không hợp lệ.',
        },
        { status: 400 }
      );
    }

    await connectDB();

    const project = await Project.findById(id);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy dự án' }, { status: 404 });
    }

    const body = parsed.data;
    if (typeof body.enabled === 'boolean') {
      project.subtitle.enabled = body.enabled;
    }

    if (body.style) {
      project.subtitle.style = {
        ...project.subtitle.style,
        ...body.style,
      };
    }

    if (Array.isArray(body.words)) {
      project.subtitle.words = body.words;
    }

    const oldSubPath = project.subtitle.path;
    const subDir = getCategoryPath('subtitles', id);
    const subFileName = `sub_${Date.now()}.ass`;
    const subFilePath = path.join(subDir, subFileName);

    const assContent = generateAssFile(project.subtitle.words, project.subtitle.style);
    await fs.promises.writeFile(subFilePath, assContent, 'utf-8');

    project.subtitle.path = subFilePath;

    if (project.status === 'voiced') {
      project.status = 'subtitled';
    }

    await project.save();

    if (oldSubPath && oldSubPath !== subFilePath) {
      await safeUnlinkStorageFile(oldSubPath);
    }

    return NextResponse.json({
      success: true,
      data: {
        project,
        subtitle: project.subtitle,
        assUrl: `/api/files/subtitles/${id}/${subFileName}`,
        assContent,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Cập nhật phụ đề thất bại';
    console.error('Update subtitle error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
