import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { connectDB } from '@/lib/db';
import { BrandPreset } from '@/lib/db/models/Preset';
import { presetCreateSchema } from '@/lib/validation/schemas';

export async function GET() {
  try {
    await connectDB();
    const presets = await BrandPreset.find({}).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ success: true, data: presets });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Lỗi tải danh sách cấu hình mẫu';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = presetCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || 'Dữ liệu cấu hình mẫu không hợp lệ',
        },
        { status: 400 }
      );
    }

    await connectDB();
    const preset = await BrandPreset.create({
      _id: nanoid(12),
      ...parsed.data,
    });

    return NextResponse.json({ success: true, data: preset }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Tạo cấu hình mẫu thất bại';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
