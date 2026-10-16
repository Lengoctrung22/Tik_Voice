import { create } from 'zustand';
import { IProject, ISubtitleStyle, IWordTimestamp } from '@/types';

export type EditorTab = 'script' | 'voice' | 'subtitle' | 'music' | 'export';

interface EditorState {
  project: IProject | null;
  activeTab: EditorTab;
  currentTime: number; // in seconds
  isPlaying: boolean;
  duration: number;
  renderProgress: number;
  isRendering: boolean;
  activeJobId: string | null;

  setProject: (project: IProject | null) => void;
  updateProjectPartial: (updates: Partial<IProject>) => void;
  updateSubtitleStyle: (style: Partial<ISubtitleStyle>) => void;
  updateWords: (words: IWordTimestamp[]) => void;
  setActiveTab: (tab: EditorTab) => void;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setDuration: (duration: number) => void;
  setRenderProgress: (progress: number) => void;
  setIsRendering: (isRendering: boolean) => void;
  setActiveJobId: (jobId: string | null) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  project: null,
  activeTab: 'script',
  currentTime: 0,
  isPlaying: false,
  duration: 0,
  renderProgress: 0,
  isRendering: false,
  activeJobId: null,

  setProject: (project) =>
    set({
      project,
      duration: project?.video?.duration || project?.tts?.audioDuration || 0,
      isRendering: project?.status === 'rendering',
    }),

  updateProjectPartial: (updates) =>
    set((state) => ({
      project: state.project ? ({ ...state.project, ...updates } as IProject) : null,
    })),

  updateSubtitleStyle: (styleUpdates) =>
    set((state) => {
      if (!state.project) return state;
      return {
        project: {
          ...state.project,
          subtitle: {
            ...state.project.subtitle,
            style: {
              ...state.project.subtitle.style,
              ...styleUpdates,
            },
          },
        } as IProject,
      };
    }),

  updateWords: (words) =>
    set((state) => {
      if (!state.project) return state;
      return {
        project: {
          ...state.project,
          subtitle: {
            ...state.project.subtitle,
            words,
          },
        } as IProject,
      };
    }),

  setActiveTab: (activeTab) => set({ activeTab }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setDuration: (duration) => set({ duration }),
  setRenderProgress: (renderProgress) => set({ renderProgress }),
  setIsRendering: (isRendering) => set({ isRendering }),
  setActiveJobId: (activeJobId) => set({ activeJobId }),
}));
