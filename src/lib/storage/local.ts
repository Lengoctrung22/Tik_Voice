import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';

export type StorageCategory = 'uploads' | 'audio' | 'subtitles' | 'music' | 'exports';

export function getStorageBasePath(): string {
  return path.resolve(process.env.STORAGE_PATH || './storage');
}

export function getCategoryPath(category: StorageCategory, subPath = ''): string {
  const basePath = getStorageBasePath();
  const targetDir = path.join(basePath, category, subPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  return targetDir;
}

export function getFileUrl(category: StorageCategory, fileName: string): string {
  const cleanName = fileName.replace(/\\/g, '/').replace(/^\/+/, '');
  return `/api/files/${category}/${cleanName}`;
}

/**
 * Xóa an toàn một tệp nằm trong STORAGE_PATH (không bao giờ xóa public/music hoặc ngoài storage).
 */
export async function safeUnlinkStorageFile(filePath?: string | null): Promise<boolean> {
  if (!filePath) return false;
  try {
    const basePath = getStorageBasePath();
    const resolved = path.resolve(filePath);
    const rel = path.relative(basePath, resolved);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
      return false;
    }
    if (fs.existsSync(resolved)) {
      await fsPromises.unlink(resolved);
      return true;
    }
  } catch {
    // Ignore file cleanup errors
  }
  return false;
}

/**
 * Dọn các file preview TTS cũ hơn maxAgeMs hoặc vượt quá maxFiles
 */
export async function cleanupPreviewCache(
  maxAgeMs = 24 * 3600 * 1000,
  maxFiles = 100
): Promise<number> {
  const previewsDir = getCategoryPath('audio', 'previews');
  let removed = 0;
  try {
    const entries = await fsPromises.readdir(previewsDir, { withFileTypes: true });
    const files: Array<{ fullPath: string; mtimeMs: number }> = [];
    const now = Date.now();

    for (const entry of entries) {
      if (!entry.isFile() || entry.name === '.gitkeep') continue;
      const fullPath = path.join(previewsDir, entry.name);
      const stat = await fsPromises.stat(fullPath);
      if (now - stat.mtimeMs > maxAgeMs) {
        await fsPromises.unlink(fullPath).catch(() => {});
        removed++;
      } else {
        files.push({ fullPath, mtimeMs: stat.mtimeMs });
      }
    }

    if (files.length > maxFiles) {
      files.sort((a, b) => a.mtimeMs - b.mtimeMs);
      const excess = files.slice(0, files.length - maxFiles);
      for (const f of excess) {
        await fsPromises.unlink(f.fullPath).catch(() => {});
        removed++;
      }
    }
  } catch {
    // Ignore cleanup errors
  }
  return removed;
}

export interface StorageUsageStats {
  totalBytes: number;
  byCategory: Record<StorageCategory | 'previews', { bytes: number; files: number }>;
}

export async function getStorageUsageStats(): Promise<StorageUsageStats> {
  const basePath = getStorageBasePath();
  const categories: StorageCategory[] = ['uploads', 'audio', 'subtitles', 'music', 'exports'];
  const byCategory: Record<StorageCategory | 'previews', { bytes: number; files: number }> = {
    uploads: { bytes: 0, files: 0 },
    audio: { bytes: 0, files: 0 },
    subtitles: { bytes: 0, files: 0 },
    music: { bytes: 0, files: 0 },
    exports: { bytes: 0, files: 0 },
    previews: { bytes: 0, files: 0 },
  };

  async function walkDir(dir: string, key: keyof typeof byCategory) {
    if (!fs.existsSync(dir)) return;
    const entries = await fsPromises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (key === 'audio' && entry.name === 'previews') {
          await walkDir(full, 'previews');
        } else {
          await walkDir(full, key);
        }
      } else if (entry.isFile() && entry.name !== '.gitkeep') {
        const stat = await fsPromises.stat(full).catch(() => null);
        if (stat) {
          byCategory[key].bytes += stat.size;
          byCategory[key].files += 1;
        }
      }
    }
  }

  for (const cat of categories) {
    await walkDir(path.join(basePath, cat), cat);
  }

  const totalBytes = Object.values(byCategory).reduce((sum, v) => sum + v.bytes, 0);
  return { totalBytes, byCategory };
}

export async function deleteProjectStorage(projectId: string): Promise<void> {
  const basePath = getStorageBasePath();
  const categories: StorageCategory[] = ['uploads', 'audio', 'subtitles', 'music', 'exports'];

  for (const cat of categories) {
    const projectDir = path.join(basePath, cat, projectId);
    try {
      if (fs.existsSync(projectDir)) {
        await fsPromises.rm(projectDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore directory not found errors
    }
  }
}
