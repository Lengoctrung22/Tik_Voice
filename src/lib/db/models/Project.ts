import mongoose, { Schema, Document } from 'mongoose';
import { nanoid } from 'nanoid';

export type ProjectStatus =
  | 'draft'
  | 'scripted'
  | 'voiced'
  | 'subtitled'
  | 'rendering'
  | 'done'
  | 'error';

export type VideoAspectMode = 'cover' | 'blur' | 'contain';
export type WatermarkPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type ExportResolution = '1080x1920' | '720x1280';

export interface IWordTimestamp {
  word: string;
  start: number; // millisecond
  end: number;   // millisecond
}

export interface IVideoClip {
  path: string;
  fileName: string;
  duration: number;
  width: number;
  height: number;
  fileSize: number;
  hasAudio?: boolean;
}

export interface IWatermarkConfig {
  enabled: boolean;
  path?: string;
  name?: string;
  position: WatermarkPosition;
  opacity: number; // 0.1 - 1.0
  scale: number;   // 0.08 - 0.35 of frame width
}

export interface ISubtitleStyle {
  fontFamily: string;
  fontSize: number;          // Mặc định: 64 (cho độ phân giải 1080p dọc)
  fontWeight: 'normal' | 'bold' | 'black';
  primaryColor: string;      // #FFFFFF (Màu chữ ban đầu)
  outlineColor: string;      // #000000 (Viền đen chống chìm)
  outlineWidth: number;      // 4
  shadowColor: string;
  shadowDepth: number;
  position: 'top' | 'center' | 'bottom';
  marginBottom: number;      // 120 (pixel)
  alignment: 'left' | 'center' | 'right';
  highlightEnabled: boolean; // Karaoke Highlight
  highlightColor: string;    // #FFD700 (Vàng gold khi đọc tới)
  animation: 'none' | 'fade' | 'typewriter' | 'bounce';
  maxCharsPerLine: number;   // 25
  wordsPerGroup: number;     // 3
}

export interface IProject extends Document<string> {
  _id: string; // nanoid(12)
  name: string;
  description?: string;
  status: ProjectStatus;

  video?: {
    path: string;
    fileName: string;
    duration: number;
    width: number;
    height: number;
    fileSize: number;
    hasAudio?: boolean;
    aspectMode?: VideoAspectMode;
    originalVolume?: number; // 0.0 - 1.0
    thumbnailPath?: string;
    clips?: IVideoClip[];
  };

  script?: {
    text: string;
    templateId?: string;
    productName?: string;
    productInfo?: string;
    customInstructions?: string;
    hookVariants?: string[];
    captionText?: string;
    hashtags?: string[];
  };

  tts: {
    engine: 'edge' | 'google';
    voice: string;
    speed: number;
    pitch: number;
    audioPath?: string;
    audioDuration?: number;
    sourceText?: string;
    isCustomAudio?: boolean;
  };

  subtitle: {
    enabled: boolean;
    path?: string;
    style: ISubtitleStyle;
    words: IWordTimestamp[];
  };

  bgMusic?: {
    path: string;
    name: string;
    volume: number;          // 0.12
    fadeIn: number;          // 2s
    fadeOut: number;         // 3s
    ducking?: boolean;       // true -> sidechaincompress
  };

  watermark?: IWatermarkConfig;

  export?: {
    path: string;
    resolution: string;      // 1080x1920 | 720x1280
    quality: 'fast' | 'balanced' | 'high';
    fileSize?: number;
    thumbnailPath?: string;
  };

  createdAt: Date;
  updatedAt: Date;
}

const VideoClipSchema = new Schema<IVideoClip>(
  {
    path: { type: String, required: true },
    fileName: { type: String, required: true },
    duration: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    fileSize: { type: Number, required: true },
    hasAudio: { type: Boolean, default: true },
  },
  { _id: false }
);

const SubtitleStyleSchema = new Schema<ISubtitleStyle>(
  {
    fontFamily: { type: String, default: 'Be Vietnam Pro' },
    fontSize: { type: Number, default: 64 },
    fontWeight: { type: String, enum: ['normal', 'bold', 'black'], default: 'bold' },
    primaryColor: { type: String, default: '#FFFFFF' },
    outlineColor: { type: String, default: '#000000' },
    outlineWidth: { type: Number, default: 4 },
    shadowColor: { type: String, default: '#00000080' },
    shadowDepth: { type: Number, default: 2 },
    position: { type: String, enum: ['top', 'center', 'bottom'], default: 'bottom' },
    marginBottom: { type: Number, default: 120 },
    alignment: { type: String, enum: ['left', 'center', 'right'], default: 'center' },
    highlightEnabled: { type: Boolean, default: true },
    highlightColor: { type: String, default: '#FFD700' },
    animation: { type: String, enum: ['none', 'fade', 'typewriter', 'bounce'], default: 'none' },
    maxCharsPerLine: { type: Number, default: 25 },
    wordsPerGroup: { type: Number, default: 3 },
  },
  { _id: false }
);

const ProjectSchema = new Schema<IProject>(
  {
    _id: { type: String, default: () => nanoid(12) },
    name: { type: String, required: true },
    description: String,
    status: {
      type: String,
      enum: ['draft', 'scripted', 'voiced', 'subtitled', 'rendering', 'done', 'error'],
      default: 'draft',
      index: true,
    },
    video: {
      path: String,
      fileName: String,
      duration: Number,
      width: Number,
      height: Number,
      fileSize: Number,
      hasAudio: { type: Boolean, default: true },
      aspectMode: { type: String, enum: ['cover', 'blur', 'contain'], default: 'contain' },
      originalVolume: { type: Number, default: 0 },
      thumbnailPath: String,
      clips: { type: [VideoClipSchema], default: undefined },
    },
    script: {
      text: String,
      templateId: String,
      productName: String,
      productInfo: String,
      customInstructions: String,
      hookVariants: [String],
      captionText: String,
      hashtags: [String],
    },
    tts: {
      engine: { type: String, enum: ['edge', 'google'], default: 'edge' },
      voice: { type: String, default: 'vi-VN-HoaiMyNeural' },
      speed: { type: Number, default: 1.0 },
      pitch: { type: Number, default: 0 },
      audioPath: String,
      audioDuration: Number,
      sourceText: String,
      isCustomAudio: { type: Boolean, default: false },
    },
    subtitle: {
      enabled: { type: Boolean, default: true },
      path: String,
      style: { type: SubtitleStyleSchema, default: () => ({}) },
      words: [
        {
          word: { type: String, required: true },
          start: { type: Number, required: true },
          end: { type: Number, required: true },
          _id: false,
        },
      ],
    },
    bgMusic: {
      path: String,
      name: String,
      volume: { type: Number, default: 0.12 },
      fadeIn: { type: Number, default: 2 },
      fadeOut: { type: Number, default: 3 },
      ducking: { type: Boolean, default: true },
    },
    watermark: {
      enabled: { type: Boolean, default: false },
      path: String,
      name: String,
      position: {
        type: String,
        enum: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
        default: 'top-right',
      },
      opacity: { type: Number, default: 0.85 },
      scale: { type: Number, default: 0.16 },
    },
    export: {
      path: String,
      resolution: { type: String, default: '1080x1920' },
      quality: { type: String, enum: ['fast', 'balanced', 'high'], default: 'balanced' },
      fileSize: Number,
      thumbnailPath: String,
    },
  },
  { timestamps: true }
);

export const Project =
  (mongoose.models.Project as mongoose.Model<IProject>) ||
  mongoose.model<IProject>('Project', ProjectSchema);
