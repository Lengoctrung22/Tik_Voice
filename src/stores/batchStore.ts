import { create } from 'zustand';
import type {
  ExportResolution,
  IPopulatedBatchGroup,
  ISubtitleStyle,
  VideoAspectMode,
} from '@/types';
import { DEFAULT_SUBTITLE_STYLE } from '@/lib/video/subtitle-presets';

export interface BatchUploadItem {
  id: string;
  file: File;
  productName: string;
  productInfo: string;
  scriptText: string;
  status?: 'pending' | 'uploading' | 'processing' | 'done' | 'error';
  progress?: number;
  projectId?: string;
  error?: string;
}

export interface BatchSharedConfig {
  voice: string;
  engine: 'edge' | 'google';
  speed: number;
  pitch: number;
  templateId: string;
  aspectMode: VideoAspectMode;
  resolution: ExportResolution;
  quality: 'fast' | 'balanced' | 'high';
  subtitleEnabled: boolean;
  subtitleStyle: Partial<ISubtitleStyle>;
  bgMusic?: {
    path: string;
    name: string;
    volume: number;
    fadeIn?: number;
    fadeOut?: number;
    ducking?: boolean;
  };
}

const defaultSharedConfig: BatchSharedConfig = {
  voice: 'vi-VN-HoaiMyNeural',
  engine: 'edge',
  speed: 1.0,
  pitch: 0,
  templateId: 'quick_review',
  aspectMode: 'contain',
  resolution: '1080x1920',
  quality: 'balanced',
  subtitleEnabled: true,
  subtitleStyle: { ...DEFAULT_SUBTITLE_STYLE },
  bgMusic: {
    path: 'public/music/lofi-chill.mp3',
    name: 'Lo-Fi Chill Nhẹ Nhàng',
    volume: 0.12,
    fadeIn: 2,
    fadeOut: 3,
    ducking: true,
  },
};

export interface CsvBatchRow {
  productName: string;
  productInfo: string;
  scriptText: string;
}

interface BatchState {
  items: BatchUploadItem[];
  sharedConfig: BatchSharedConfig;
  batchName: string;
  batches: IPopulatedBatchGroup[];
  activeBatch: IPopulatedBatchGroup | null;
  loading: boolean;
  isSubmitting: boolean;

  setItems: (items: BatchUploadItem[]) => void;
  addFiles: (files: File[]) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<BatchUploadItem>) => void;
  applyCsvRows: (rows: CsvBatchRow[]) => number;
  clearItems: () => void;
  setBatchName: (name: string) => void;
  setSharedConfig: (config: BatchSharedConfig) => void;
  updateSharedConfig: (updates: Partial<BatchSharedConfig>) => void;
  setBatches: (batches: IPopulatedBatchGroup[]) => void;
  setActiveBatch: (batch: IPopulatedBatchGroup | null) => void;
  setLoading: (loading: boolean) => void;
  setIsSubmitting: (isSubmitting: boolean) => void;
  resetBatchForm: () => void;
}

export const useBatchStore = create<BatchState>((set) => ({
  items: [],
  sharedConfig: defaultSharedConfig,
  batchName: '',
  batches: [],
  activeBatch: null,
  loading: false,
  isSubmitting: false,

  setItems: (items) => set({ items }),

  addFiles: (files) =>
    set((state) => {
      const newItems: BatchUploadItem[] = files.map((f, i) => {
        const rawName = f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        return {
          id: `${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`,
          file: f,
          productName: rawName,
          productInfo: '',
          scriptText: '',
          status: 'pending',
          progress: 0,
        };
      });
      return { items: [...state.items, ...newItems] };
    }),

  removeItem: (id) =>
    set((state) => ({ items: state.items.filter((item) => item.id !== id) })),

  updateItem: (id, updates) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    })),

  applyCsvRows: (rows) => {
    let appliedCount = 0;
    set((state) => {
      const updated = state.items.map((item, idx) => {
        const row = rows[idx];
        if (!row) return item;
        appliedCount++;
        return {
          ...item,
          productName: row.productName || item.productName,
          productInfo: row.productInfo ?? item.productInfo,
          scriptText: row.scriptText ?? item.scriptText,
        };
      });
      return { items: updated };
    });
    return appliedCount;
  },

  clearItems: () => set({ items: [] }),
  setBatchName: (batchName) => set({ batchName }),
  setSharedConfig: (sharedConfig) => set({ sharedConfig }),

  updateSharedConfig: (updates) =>
    set((state) => ({
      sharedConfig: {
        ...state.sharedConfig,
        ...updates,
        subtitleStyle: {
          ...state.sharedConfig.subtitleStyle,
          ...(updates.subtitleStyle || {}),
        },
        bgMusic: 'bgMusic' in updates ? updates.bgMusic : state.sharedConfig.bgMusic,
      },
    })),

  setBatches: (batches) => set({ batches }),
  setActiveBatch: (activeBatch) => set({ activeBatch }),
  setLoading: (loading) => set({ loading }),
  setIsSubmitting: (isSubmitting) => set({ isSubmitting }),

  resetBatchForm: () =>
    set({
      items: [],
      batchName: '',
      sharedConfig: defaultSharedConfig,
    }),
}));
