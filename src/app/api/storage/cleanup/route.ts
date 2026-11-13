import { NextResponse } from 'next/server';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { connectDB } from '@/lib/db';
import { Project } from '@/lib/db/models/Project';
import {
  cleanupPreviewCache,
  getStorageBasePath,
  getStorageUsageStats,
  StorageCategory,
} from '@/lib/storage/local';

export async function POST() {
  try {
    await connectDB();

    // 1. Dọn toàn bộ cache preview giọng đọc
    const removedPreviews = await cleanupPreviewCache(0, 0);

    // 2. Dọn thư mục mồ côi của các dự án đã bị xóa khỏi DB
    const existingIds = new Set(
      (await Project.find({}).select('_id').lean()).map((p) => String(p._id))
    );

    const basePath = getStorageBasePath();
    const categories: StorageCategory[] = ['uploads', 'audio', 'subtitles', 'music', 'exports'];
    let removedOrphanDirs = 0;

    for (const cat of categories) {
      const catDir = path.join(basePath, cat);
      if (!fs.existsSync(catDir)) continue;
      const entries = await fsPromises.readdir(catDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (cat === 'audio' && entry.name === 'previews') continue;
        if (!existingIds.has(entry.name)) {
          await fsPromises.rm(path.join(catDir, entry.name), { recursive: true, force: true });
          removedOrphanDirs++;
        }
      }
    }

    const storage = await getStorageUsageStats();

    return NextResponse.json({
      success: true,
      message: `Đã dọn ${removedPreviews} tệp nghe thử và ${removedOrphanDirs} thư mục cũ.`,
      data: {
        removedPreviews,
        removedOrphanDirs,
        storage,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Dọn dẹp bộ nhớ thất bại';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
