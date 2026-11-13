import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Project } from '@/lib/db/models/Project';
import { generateHookVariants, generateTikTokCaption } from '@/lib/ai/prompts';

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
      mode?: 'hooks' | 'caption';
      productName?: string;
      productInfo?: string;
      scriptText?: string;
    };

    if (body.mode === 'hooks') {
      const productName = (body.productName || project.script?.productName || project.name || '').trim();
      if (!productName) {
        return NextResponse.json(
          { success: false, error: 'Vui lòng nhập tên sản phẩm để tạo gợi ý mở đầu (Hook).' },
          { status: 400 }
        );
      }

      const hooks = await generateHookVariants({
        productName,
        productInfo: body.productInfo ?? project.script?.productInfo,
        currentScript: body.scriptText ?? project.script?.text,
      });

      project.script = {
        text: project.script?.text || '',
        ...project.script,
        hookVariants: hooks,
      };
      await project.save();

      return NextResponse.json({
        success: true,
        data: { hookVariants: hooks, project },
      });
    }

    // Caption + Hashtags TikTok
    const { caption, hashtags } = await generateTikTokCaption({
      productName: body.productName || project.script?.productName || project.name,
      scriptText: body.scriptText || project.script?.text,
    });

    project.script = {
      text: project.script?.text || '',
      ...project.script,
      captionText: caption,
      hashtags,
    };
    await project.save();

    return NextResponse.json({
      success: true,
      data: { caption, hashtags, project },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Tạo nội dung tiếp thị thất bại';
    console.error('Marketing AI error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
