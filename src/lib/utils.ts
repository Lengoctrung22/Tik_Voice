import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0 || !isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function resolveMediaUrl(filePath?: string | null): string {
  if (!filePath) return '';
  const norm = filePath.replace(/\\/g, '/').trim();
  if (!norm) return '';
  if (
    norm.startsWith('http://') ||
    norm.startsWith('https://') ||
    norm.startsWith('/api/files/') ||
    norm.startsWith('/music/')
  ) {
    return norm;
  }
  if (norm.includes('/public/')) {
    return `/${norm.split('/public/')[1]}`;
  }
  if (norm.startsWith('public/')) {
    return `/${norm.slice('public/'.length)}`;
  }
  if (norm.includes('/storage/')) {
    return `/api/files/${norm.split('/storage/').pop()}`;
  }
  if (norm.startsWith('storage/')) {
    return `/api/files/${norm.slice('storage/'.length)}`;
  }
  const catMatch = norm.match(/(?:^|\/)((?:uploads|audio|subtitles|music|exports)\/.+)$/);
  if (catMatch) {
    return `/api/files/${catMatch[1]}`;
  }
  return '';
}
