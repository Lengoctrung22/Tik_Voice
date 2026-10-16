import { create } from 'zustand';
import { IBatchGroup } from '@/types';

interface BatchState {
  batches: IBatchGroup[];
  activeBatch: IBatchGroup | null;
  loading: boolean;

  setBatches: (batches: IBatchGroup[]) => void;
  setActiveBatch: (batch: IBatchGroup | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useBatchStore = create<BatchState>((set) => ({
  batches: [],
  activeBatch: null,
  loading: false,

  setBatches: (batches) => set({ batches }),
  setActiveBatch: (activeBatch) => set({ activeBatch }),
  setLoading: (loading) => set({ loading }),
}));
