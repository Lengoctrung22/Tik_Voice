import mongoose, { Schema, Document, Model } from 'mongoose';
import { nanoid } from 'nanoid';

export interface IJob extends Document<string> {
  _id: string;
  projectId: string;
  bullmqJobId?: string;
  type: 'tts' | 'subtitle' | 'render' | 'full_pipeline';
  status: 'queued' | 'processing' | 'done' | 'error';
  progress: number;
  error?: string;
  result?: unknown;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const JobSchema = new Schema(
  {
    _id: { type: String, default: () => nanoid(12) },
    projectId: { type: String, ref: 'Project', required: true, index: true },
    bullmqJobId: String,
    type: { type: String, enum: ['tts', 'subtitle', 'render', 'full_pipeline'], required: true },
    status: { type: String, enum: ['queued', 'processing', 'done', 'error'], default: 'queued', index: true },
    progress: { type: Number, default: 0 },
    error: String,
    result: Schema.Types.Mixed,
    completedAt: Date,
  },
  { timestamps: true }
);

export const Job: Model<IJob> =
  (mongoose.models.Job as Model<IJob>) || mongoose.model<IJob>('Job', JobSchema);
