import mongoose, { Schema, Document, Model } from 'mongoose';
import { nanoid } from 'nanoid';

export interface IBatchItem {
  projectId: string;
  order: number;
  status: 'pending' | 'processing' | 'done' | 'error';
  error?: string;
}

export interface IBatchGroup extends Document<string> {
  _id: string;
  name?: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  items: IBatchItem[];
  sharedConfig?: Record<string, unknown>;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BatchGroupSchema = new Schema(
  {
    _id: { type: String, default: () => nanoid(12) },
    name: String,
    status: { type: String, enum: ['pending', 'processing', 'done', 'error'], default: 'pending' },
    items: [
      {
        projectId: { type: String, ref: 'Project' },
        order: Number,
        status: { type: String, enum: ['pending', 'processing', 'done', 'error'], default: 'pending' },
        error: String,
      },
    ],
    sharedConfig: Schema.Types.Mixed,
    completedAt: Date,
  },
  { timestamps: true }
);

export const BatchGroup: Model<IBatchGroup> =
  (mongoose.models.BatchGroup as Model<IBatchGroup>) ||
  mongoose.model<IBatchGroup>('BatchGroup', BatchGroupSchema);
