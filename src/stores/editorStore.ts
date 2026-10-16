import { create } from 'zustand';
import { IProject, ISubtitleStyle, IWordTimestamp } from '@/types';

export type EditorTab = 'script' | 'voice' | 'subtitle' | 'music' | 'export';
export type PreviewMode = 'preview' | 'export';

interface EditorState {
  project: IProject | null;
  activeTab: EditorTab;
  currentTime: number; // in seconds
  isPlaying: boolean;
  duration: number;
  previewMode: PreviewMode;
  renderProgress: number;
  isRendering: boolean;
  activeJobId: string | null;
  seekTarget: { time: number; timestamp: number } | null;

  setProject: (project: IProject | null) => void;
  updateProjectPartial: (updates: Partial<IProject>) => void;
  updateSubtitleStyle: (style: Partial<ISubtitleStyle>) => void;
  updateWords: (words: IWordTimestamp[]) => void;
  updateBgMusic: (bgMusic: Partial<NonNullable<IProject['bgMusic']>> | undefined) => void;
  syncProject: (updates?: Partial<IProject>) => Promise<boolean>;
  setActiveTab: (tab: EditorTab) => void;
  setCurrentTime: (time: number) => void;
  seekTo: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setDuration: (duration: number) => void;
  setPreviewMode: (mode: PreviewMode) => void;
  setRenderProgress: (progress: number) => void;
  setIsRendering: (isRendering: boolean) => void;
  setActiveJobId: (jobId: string | null) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  project: null,
  activeTab: 'script',
  currentTime: 0,
  isPlaying: false,
  duration: 0,
  previewMode: 'preview',
  renderProgress: 0,
  isRendering: false,
  activeJobId: null,
  seekTarget: null,

  setProject: (project) =>
    set({
      project,
      duration: project?.video?.duration || project?.tts?.audioDuration || 0,
      isRendering: project?.status === 'rendering',
      activeJobId: (project as any)?.activeJobId || null,
      previewMode: project?.status === 'done' && project?.export?.path ? 'export' : 'preview',
    }),

  updateProjectPartial: (updates) =>
    set((state) => ({
      project: state.project ? ({ ...state.project, ...updates } as IProject) : null,
      duration:
        updates.video?.duration ||
        updates.tts?.audioDuration ||
        state.project?.video?.duration ||
        state.project?.tts?.audioDuration ||
        state.duration,
    })),

  updateSubtitleStyle: (styleUpdates) =>
    set((state) => {
      if (!state.project) return state;
      const prevSubtitle = state.project.subtitle || {
        enabled: true,
        style: {
          fontFamily: 'Be Vietnam Pro',
          fontSize: 64,
          fontWeight: 'bold',
          primaryColor: '#FFFFFF',
          outlineColor: '#000000',
          outlineWidth: 4,
          shadowColor: '#00000080',
          shadowDepth: 2,
          position: 'bottom',
          marginBottom: 120,
          alignment: 'center',
          highlightEnabled: true,
          highlightColor: '#FFD700',
          animation: 'none',
          maxCharsPerLine: 25,
          wordsPerGroup: 3,
        },
        words: [],
      };
      return {
        project: {
          ...state.project,
          subtitle: {
            ...prevSubtitle,
            style: {
              ...prevSubtitle.style,
              ...styleUpdates,
            },
          },
        } as IProject,
      };
    }),

  updateWords: (words) =>
    set((state) => {
      if (!state.project) return state;
      const prevSubtitle = state.project.subtitle || {
        enabled: true,
        style: {} as any,
        words: [],
      };
      return {
        project: {
          ...state.project,
          subtitle: {
            ...prevSubtitle,
            words,
          },
        } as IProject,
      };
    }),

  updateBgMusic: (bgMusicUpdates) =>
    set((state) => {
      if (!state.project) return state;
      if (!bgMusicUpdates) {
        const updated = { ...state.project };
        delete (updated as any).bgMusic;
        return { project: updated as IProject };
      }
      return {
        project: {
          ...state.project,
          bgMusic: {
            path: '',
            name: '',
            volume: 0.12,
            fadeIn: 2,
            fadeOut: 3,
            ...state.project.bgMusic,
            ...bgMusicUpdates,
          },
        } as IProject,
      };
    }),

  syncProject: async (updates) => {
    const state = get();
    if (!state.project?._id) return false;

    // Apply local optimistic update first if updates provided
    if (updates) {
      state.updateProjectPartial(updates);
    }

    try {
      const payload = updates || state.project;
      const res = await fetch(`/api/projects/${state.project._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success && data.data) {
        set({ project: data.data });
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to sync project:', err);
      return false;
    }
  },

  setActiveTab: (activeTab) => set({ activeTab }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  seekTo: (time) =>
    set({
      currentTime: time,
      seekTarget: { time, timestamp: Date.now() },
    }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setDuration: (duration) => set({ duration }),
  setPreviewMode: (previewMode) => set({ previewMode }),
  setRenderProgress: (renderProgress) => set({ renderProgress }),
  setIsRendering: (isRendering) => set({ isRendering }),
  setActiveJobId: (activeJobId) => set({ activeJobId }),
}));
