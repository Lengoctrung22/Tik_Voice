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
  // Returns normalized API URL for HTTP 206 Partial Content Streamer
  const cleanName = fileName.replace(/\\/g, '/').replace(/^\/+/, '');
  return `/api/files/${category}/${cleanName}`;
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
