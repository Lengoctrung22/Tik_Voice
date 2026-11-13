import type { Document } from 'mongoose';
import type { IProject, ProjectStatus } from '@/lib/db/models/Project';
import type { IBatchGroup } from '@/lib/db/models/BatchGroup';
import type { IBrandPreset } from '@/lib/db/models/Preset';

export * from '@/lib/db/models/Project';
export * from '@/lib/db/models/Job';
export * from '@/lib/db/models/BatchGroup';
export * from '@/lib/db/models/Preset';

export interface ProjectDTO extends Omit<IProject, keyof Document> {
  _id: string;
  activeJobId?: string | null;
}

export interface IPopulatedBatchItem {
  projectId: IProject | string;
  order: number;
  status: 'pending' | 'processing' | 'done' | 'error';
  error?: string;
}

export interface IPopulatedBatchGroup extends Omit<IBatchGroup, 'items'> {
  items: IPopulatedBatchItem[];
}

export interface TTSOptions {
  voice?: string;
  speed?: number;
  pitch?: number;
  engine?: 'edge' | 'google';
  applyPronunciation?: boolean;
}

export interface Voice {
  id: string;
  name: string;
  gender: 'female' | 'male';
  region: 'Miền Bắc' | 'Miền Nam' | 'Chuẩn';
  locale: string;
  engine: 'edge' | 'google';
  tier: 'free' | 'premium';
  displayName: string;
  description: string;
}

export interface TTSResult {
  audioPath: string;
  audioDuration: number;
  words: Array<{
    word: string;
    start: number; // ms
    end: number;   // ms
  }>;
  actualEngine?: 'edge' | 'google';
  actualVoice?: string;
  fallbackFrom?: 'google';
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export type BrandPresetDTO = Omit<IBrandPreset, keyof Document> & { _id: string };
export type { ProjectStatus };
