import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Project } from '@/lib/db/models/Project';
import { generateProductScript, SCRIPT_TEMPLATES } from '@/lib/ai/prompts';

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
      data: {
        script: project.script,
        templates: Object.values(SCRIPT_TEMPLATES).map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          estimatedDuration: t.estimatedDuration,
          maxWords: t.maxWords,
        })),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy thông tin kịch bản';
    console.error('Get script error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();

    const project = await Project.findById(id);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy dự án' }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      productName?: string;
      productInfo?: string;
      templateId?: string;
      customInstructions?: string;
      text?: string;
      generateWithAI?: boolean;
      productImageBase64?: string;
      productImageMimeType?: string;
    };

    const {
      productName,
      productInfo,
      templateId,
      customInstructions,
      text,
      generateWithAI,
      productImageBase64,
      productImageMimeType,
    } = body;

    let finalScriptText = typeof text === 'string' ? text : '';
    const isManualSave = !generateWithAI && typeof text === 'string';

    if (!isManualSave && (generateWithAI || !finalScriptText.trim())) {
      if (!productName?.trim()) {
        return NextResponse.json(
          { success: false, error: 'Vui lòng nhập tên sản phẩm để AI viết kịch bản.' },
          { status: 400 }
        );
      }

      finalScriptText = await generateProductScript({
        productName: productName.trim(),
        productInfo: productInfo || '',
        templateId: templateId || 'quick_review',
        customInstructions,
        productImageBase64,
        productImageMimeType,
      });
    }

    project.script = {
      ...project.script,
      text: finalScriptText,
      templateId,
      productName,
      productInfo,
      customInstructions,
    };

    if (project.status === 'draft' && finalScriptText.trim()) {
      project.status = 'scripted';
    }

    await project.save();

    return NextResponse.json({
      success: true,
      data: {
        project,
        script: project.script,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Tạo kịch bản thất bại';
    console.error('Script generation error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
