import { IProject } from '@/lib/db/models/Project';
import { IBatchGroup } from '@/lib/db/models/BatchGroup';

export * from '@/lib/db/models/Project';
export * from '@/lib/db/models/Job';
export * from '@/lib/db/models/BatchGroup';

export interface IPopulatedBatchItem {
  projectId: IProject;
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
}

export interface Voice {
  id: string;
  name: string;
  gender: 'female' | 'male';
  locale: string;
  engine: 'edge' | 'google';
  displayName: string;
}

export interface TTSResult {
  audioPath: string;
  audioDuration: number;
  words: Array<{
    word: string;
    start: number; // ms
    end: number;   // ms
  }>;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
