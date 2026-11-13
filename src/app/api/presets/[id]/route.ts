import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { BrandPreset } from '@/lib/db/models/Preset';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();

    const deleted = await BrandPreset.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy cấu hình mẫu' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Đã xóa cấu hình mẫu' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Xóa cấu hình mẫu thất bại';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
