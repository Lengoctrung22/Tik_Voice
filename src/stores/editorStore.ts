import { create } from 'zustand';
import type {
  BrandPresetDTO,
  ISubtitleStyle,
  IWatermarkConfig,
  IWordTimestamp,
  ProjectDTO,
} from '@/types';
import { DEFAULT_SUBTITLE_STYLE } from '@/lib/video/subtitle-presets';

export type EditorTab = 'script' | 'voice' | 'subtitle' | 'music' | 'export';
export type PreviewMode = 'preview' | 'export';
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const ALLOWED_FONT_FAMILIES = ['Be Vietnam Pro', 'Montserrat', 'Inter', 'Roboto'] as const;

function sanitizeSubtitleStyle(style?: Partial<ISubtitleStyle>): Partial<ISubtitleStyle> {
  if (!style) return {};
  const fontFamily = ALLOWED_FONT_FAMILIES.includes(
    style.fontFamily as (typeof ALLOWED_FONT_FAMILIES)[number]
  )
    ? style.fontFamily
    : 'Be Vietnam Pro';

  return {
    fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    primaryColor: style.primaryColor,
    outlineColor: style.outlineColor,
    outlineWidth: style.outlineWidth,
    shadowColor: style.shadowColor,
    shadowDepth: style.shadowDepth,
    position: style.position,
    marginBottom: style.marginBottom,
    alignment: style.alignment,
    highlightEnabled: style.highlightEnabled,
    highlightColor: style.highlightColor,
    animation: style.animation,
    maxCharsPerLine: style.maxCharsPerLine,
    wordsPerGroup: style.wordsPerGroup,
  };
}

function buildSanitizedPatch(project: ProjectDTO): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    name: project.name,
    description: project.description ?? '',
  };

  if (project.video) {
    patch.video = {
      ...(project.video.aspectMode ? { aspectMode: project.video.aspectMode } : {}),
      ...(typeof project.video.originalVolume === 'number'
        ? { originalVolume: project.video.originalVolume }
        : {}),
      ...(Array.isArray(project.video.clips)
        ? {
            clips: project.video.clips.map((c) => ({
              path: c.path,
              fileName: c.fileName,
              duration: c.duration,
              width: c.width,
              height: c.height,
              fileSize: c.fileSize,
              hasAudio: c.hasAudio ?? true,
            })),
          }
        : {}),
    };
  }

  if (project.script) {
    patch.script = {
      text: project.script.text ?? '',
      ...(project.script.templateId !== undefined ? { templateId: project.script.templateId } : {}),
      ...(project.script.productName !== undefined ? { productName: project.script.productName } : {}),
      ...(project.script.productInfo !== undefined ? { productInfo: project.script.productInfo } : {}),
      ...(project.script.customInstructions !== undefined
        ? { customInstructions: project.script.customInstructions }
        : {}),
      ...(Array.isArray(project.script.hookVariants)
        ? { hookVariants: project.script.hookVariants }
        : {}),
      ...(project.script.captionText !== undefined ? { captionText: project.script.captionText } : {}),
      ...(Array.isArray(project.script.hashtags) ? { hashtags: project.script.hashtags } : {}),
    };
  }

  if (project.tts) {
    patch.tts = {
      engine: project.tts.engine || 'edge',
      voice: project.tts.voice || 'vi-VN-HoaiMyNeural',
      speed: project.tts.speed ?? 1.0,
      pitch: project.tts.pitch ?? 0,
    };
  }

  if (project.subtitle) {
    patch.subtitle = {
      enabled: project.subtitle.enabled ?? true,
      style: sanitizeSubtitleStyle(project.subtitle.style),
      words: (project.subtitle.words || []).map((w) => ({
        word: w.word,
        start: w.start,
        end: w.end,
      })),
    };
  }

  if (project.bgMusic && project.bgMusic.path) {
    patch.bgMusic = {
      path: project.bgMusic.path,
      name: project.bgMusic.name || 'Nhạc nền',
      volume: project.bgMusic.volume ?? 0.12,
      fadeIn: project.bgMusic.fadeIn ?? 2,
      fadeOut: project.bgMusic.fadeOut ?? 3,
      ducking: project.bgMusic.ducking ?? true,
    };
  } else {
    patch.bgMusic = null;
  }

  if (project.watermark) {
    patch.watermark = {
      enabled: Boolean(project.watermark.enabled),
      path: project.watermark.path || '',
      name: project.watermark.name || '',
      position: project.watermark.position || 'top-right',
      opacity: project.watermark.opacity ?? 0.85,
      scale: project.watermark.scale ?? 0.16,
    };
  } else {
    patch.watermark = null;
  }

  if (project.export) {
    patch.export = {
      resolution: project.export.resolution === '720x1280' ? '720x1280' : '1080x1920',
      quality: project.export.quality || 'balanced',
    };
  }

  return patch;
}

interface EditorState {
  project: ProjectDTO | null;
  activeTab: EditorTab;
  currentTime: number;
  isPlaying: boolean;
  duration: number;
  previewMode: PreviewMode;
  safeZoneVisible: boolean;
  renderProgress: number;
  isRendering: boolean;
  activeJobId: string | null;
  seekTarget: { time: number; timestamp: number } | null;
  saveStatus: SaveStatus;
  lastSavedAt: number | null;
  dirtyVersion: number;
  savedVersion: number;

  setProject: (project: ProjectDTO | null) => void;
  updateProjectPartial: (updates: Partial<ProjectDTO>, markDirty?: boolean) => void;
  updateSubtitleStyle: (style: Partial<ISubtitleStyle>) => void;
  updateWords: (words: IWordTimestamp[]) => void;
  updateBgMusic: (bgMusic: Partial<NonNullable<ProjectDTO['bgMusic']>> | undefined) => void;
  updateWatermark: (watermark: Partial<IWatermarkConfig> | undefined) => void;
  applyBrandPreset: (preset: BrandPresetDTO) => void;
  syncProject: (explicitPatch?: Record<string, unknown>) => Promise<boolean>;
  setActiveTab: (tab: EditorTab) => void;
  setCurrentTime: (time: number) => void;
  seekTo: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setDuration: (duration: number) => void;
  setPreviewMode: (mode: PreviewMode) => void;
  setSafeZoneVisible: (visible: boolean) => void;
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
  safeZoneVisible: false,
  renderProgress: 0,
  isRendering: false,
  activeJobId: null,
  seekTarget: null,
  saveStatus: 'idle',
  lastSavedAt: null,
  dirtyVersion: 0,
  savedVersion: 0,

  setProject: (project) =>
    set({
      project,
      duration: project?.tts?.audioDuration || project?.video?.duration || 0,
      isRendering: project?.status === 'rendering',
      activeJobId: project?.activeJobId || null,
      previewMode: project?.status === 'done' && project?.export?.path ? 'export' : 'preview',
      saveStatus: 'idle',
      dirtyVersion: 0,
      savedVersion: 0,
    }),

  updateProjectPartial: (updates, markDirty = true) =>
    set((state) => {
      if (!state.project) return state;
      const merged: ProjectDTO = {
        ...state.project,
        ...updates,
        video: updates.video
          ? { ...(state.project.video || {}), ...updates.video } as ProjectDTO['video']
          : state.project.video,
        script: updates.script
          ? { ...(state.project.script || { text: '' }), ...updates.script }
          : state.project.script,
        tts: updates.tts
          ? { ...state.project.tts, ...updates.tts }
          : state.project.tts,
        subtitle: updates.subtitle
          ? { ...state.project.subtitle, ...updates.subtitle }
          : state.project.subtitle,
        export: updates.export
          ? { ...(state.project.export || { path: '', resolution: '1080x1920', quality: 'balanced' }), ...updates.export }
          : state.project.export,
      };
      return {
        project: merged,
        duration:
          merged.tts?.audioDuration ||
          merged.video?.duration ||
          state.duration,
        dirtyVersion: markDirty ? state.dirtyVersion + 1 : state.dirtyVersion,
      };
    }),

  updateSubtitleStyle: (styleUpdates) =>
    set((state) => {
      if (!state.project) return state;
      const prevSubtitle = state.project.subtitle || {
        enabled: true,
        style: DEFAULT_SUBTITLE_STYLE,
        words: [],
      };
      return {
        project: {
          ...state.project,
          subtitle: {
            ...prevSubtitle,
            style: {
              ...DEFAULT_SUBTITLE_STYLE,
              ...prevSubtitle.style,
              ...styleUpdates,
            },
          },
        },
        dirtyVersion: state.dirtyVersion + 1,
      };
    }),

  updateWords: (words) =>
    set((state) => {
      if (!state.project) return state;
      const prevSubtitle = state.project.subtitle || {
        enabled: true,
        style: DEFAULT_SUBTITLE_STYLE,
        words: [],
      };
      return {
        project: {
          ...state.project,
          subtitle: {
            ...prevSubtitle,
            words,
          },
        },
        dirtyVersion: state.dirtyVersion + 1,
      };
    }),

  updateBgMusic: (bgMusicUpdates) =>
    set((state) => {
      if (!state.project) return state;
      if (!bgMusicUpdates) {
        return {
          project: {
            ...state.project,
            bgMusic: undefined,
          },
          dirtyVersion: state.dirtyVersion + 1,
        };
      }
      return {
        project: {
          ...state.project,
          bgMusic: {
            path: state.project.bgMusic?.path || '',
            name: state.project.bgMusic?.name || '',
            volume: state.project.bgMusic?.volume ?? 0.12,
            fadeIn: state.project.bgMusic?.fadeIn ?? 2,
            fadeOut: state.project.bgMusic?.fadeOut ?? 3,
            ducking: state.project.bgMusic?.ducking ?? true,
            ...bgMusicUpdates,
          },
        },
        dirtyVersion: state.dirtyVersion + 1,
      };
    }),

  updateWatermark: (watermarkUpdates) =>
    set((state) => {
      if (!state.project) return state;
      if (!watermarkUpdates) {
        return {
          project: {
            ...state.project,
            watermark: undefined,
          },
          dirtyVersion: state.dirtyVersion + 1,
        };
      }
      return {
        project: {
          ...state.project,
          watermark: {
            enabled: state.project.watermark?.enabled ?? false,
            path: state.project.watermark?.path || '',
            name: state.project.watermark?.name || '',
            position: state.project.watermark?.position || 'top-right',
            opacity: state.project.watermark?.opacity ?? 0.85,
            scale: state.project.watermark?.scale ?? 0.16,
            ...watermarkUpdates,
          },
        },
        dirtyVersion: state.dirtyVersion + 1,
      };
    }),

  applyBrandPreset: (preset) =>
    set((state) => {
      if (!state.project) return state;
      const prev = state.project;
      return {
        project: {
          ...prev,
          video: prev.video
            ? {
                ...prev.video,
                aspectMode: preset.aspectMode || prev.video.aspectMode || 'contain',
                originalVolume:
                  typeof preset.originalVolume === 'number'
                    ? preset.originalVolume
                    : prev.video.originalVolume ?? 0,
              }
            : prev.video,
          tts: {
            ...prev.tts,
            engine: preset.engine,
            voice: preset.voice,
            speed: preset.speed,
            pitch: preset.pitch,
          },
          subtitle: {
            ...prev.subtitle,
            enabled: preset.subtitleEnabled,
            style: {
              ...DEFAULT_SUBTITLE_STYLE,
              ...(prev.subtitle?.style || {}),
              ...(preset.subtitleStyle || {}),
            },
          },
          bgMusic: preset.bgMusic
            ? {
                path: preset.bgMusic.path,
                name: preset.bgMusic.name,
                volume: preset.bgMusic.volume ?? 0.12,
                fadeIn: preset.bgMusic.fadeIn ?? 2,
                fadeOut: preset.bgMusic.fadeOut ?? 3,
                ducking: preset.bgMusic.ducking ?? true,
              }
            : undefined,
          export: {
            path: prev.export?.path || '',
            resolution: preset.exportResolution || '1080x1920',
            quality: preset.exportQuality || 'balanced',
            fileSize: prev.export?.fileSize,
            thumbnailPath: prev.export?.thumbnailPath,
          },
        },
        dirtyVersion: state.dirtyVersion + 1,
      };
    }),

  syncProject: async (explicitPatch) => {
    const state = get();
    if (!state.project?._id) return false;

    const versionAtStart = state.dirtyVersion;
    set({ saveStatus: 'saving' });

    try {
      const payload = explicitPatch || buildSanitizedPatch(state.project);
      const res = await fetch(`/api/projects/${state.project._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { success: boolean; data?: ProjectDTO };
      if (!res.ok || !json.success || !json.data) {
        set({ saveStatus: 'error' });
        return false;
      }

      const currentState = get();
      // Chỉ ghi đè nếu không có chỉnh sửa mới hơn trong lúc đang gọi API
      if (currentState.dirtyVersion === versionAtStart) {
        set({
          project: json.data,
          saveStatus: 'saved',
          lastSavedAt: Date.now(),
          savedVersion: versionAtStart,
        });
      } else {
        set({
          saveStatus: 'saved',
          lastSavedAt: Date.now(),
          savedVersion: versionAtStart,
        });
      }
      return true;
    } catch (err) {
      console.error('Failed to sync project:', err);
      set({ saveStatus: 'error' });
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
  setSafeZoneVisible: (safeZoneVisible) => set({ safeZoneVisible }),
  setRenderProgress: (renderProgress) => set({ renderProgress }),
  setIsRendering: (isRendering) => set({ isRendering }),
  setActiveJobId: (activeJobId) => set({ activeJobId }),
}));
