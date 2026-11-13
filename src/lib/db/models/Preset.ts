import mongoose, { Schema, Document, Model } from 'mongoose';
import { nanoid } from 'nanoid';
import type { ISubtitleStyle, VideoAspectMode, ExportResolution } from './Project';

export interface IBrandPreset extends Document<string> {
  _id: string;
  name: string;
  engine: 'edge' | 'google';
  voice: string;
  speed: number;
  pitch: number;
  aspectMode: VideoAspectMode;
  originalVolume: number;
  subtitleEnabled: boolean;
  subtitleStyle: Partial<ISubtitleStyle>;
  bgMusic?: {
    path: string;
    name: string;
    volume: number;
    fadeIn: number;
    fadeOut: number;
    ducking: boolean;
  };
  exportResolution: ExportResolution;
  exportQuality: 'fast' | 'balanced' | 'high';
  createdAt: Date;
  updatedAt: Date;
}

const BrandPresetSchema = new Schema<IBrandPreset>(
  {
    _id: { type: String, default: () => nanoid(12) },
    name: { type: String, required: true },
    engine: { type: String, enum: ['edge', 'google'], default: 'edge' },
    voice: { type: String, default: 'vi-VN-HoaiMyNeural' },
    speed: { type: Number, default: 1.0 },
    pitch: { type: Number, default: 0 },
    aspectMode: { type: String, enum: ['cover', 'blur', 'contain'], default: 'contain' },
    originalVolume: { type: Number, default: 0 },
    subtitleEnabled: { type: Boolean, default: true },
    subtitleStyle: { type: Schema.Types.Mixed, default: () => ({}) },
    bgMusic: {
      path: String,
      name: String,
      volume: Number,
      fadeIn: Number,
      fadeOut: Number,
      ducking: Boolean,
    },
    exportResolution: { type: String, enum: ['1080x1920', '720x1280'], default: '1080x1920' },
    exportQuality: { type: String, enum: ['fast', 'balanced', 'high'], default: 'balanced' },
  },
  { timestamps: true }
);

export const BrandPreset: Model<IBrandPreset> =
  (mongoose.models.BrandPreset as Model<IBrandPreset>) ||
  mongoose.model<IBrandPreset>('BrandPreset', BrandPresetSchema);
