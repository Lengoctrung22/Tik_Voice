import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { connectDB } from '@/lib/db';
import { BatchGroup } from '@/lib/db/models/BatchGroup';
import { Project } from '@/lib/db/models/Project';
import { Job } from '@/lib/db/models/Job';
import { getVideoQueue } from '@/lib/queue/queues';
import { nanoid } from 'nanoid';
import { ttsEngine } from '@/lib/tts/engine';
import { getCategoryPath } from '@/lib/storage/local';
import { generateAssFile } from '@/lib/video/subtitle';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();

    const batch = await BatchGroup.findById(id).populate('items.projectId');
    if (!batch) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy lô batch' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: batch });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Lỗi lấy thông tin lô batch';
    console.error('Get batch error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();

    const batch = await BatchGroup.findById(id);
    if (!batch) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy lô batch' }, { status: 404 });
    }

    batch.status = 'processing';
    await batch.save();

    const queue = getVideoQueue();
    let queuedCount = 0;

    // Queue projects in the batch sequentially
    for (const item of batch.items) {
      const project = await Project.findById(item.projectId);

      // On-the-fly TTS synthesis fallback if audio was not yet created
      if (project && project.video?.path && !project.tts?.audioPath && project.script?.text?.trim()) {
        try {
          const audioDir = getCategoryPath('audio', project._id);
          const audioFileName = `speech_${Date.now()}.mp3`;
          const outputPath = path.join(audioDir, audioFileName);
          const ttsResult = await ttsEngine.synthesize(project.script.text, outputPath, {
            voice: project.tts?.voice || 'vi-VN-HoaiMyNeural',
            speed: project.tts?.speed ?? 1.0,
            pitch: project.tts?.pitch ?? 0,
            engine: project.tts?.engine || 'edge',
          });

          project.tts = {
            engine: project.tts?.engine || 'edge',
            voice: project.tts?.voice || 'vi-VN-HoaiMyNeural',
            speed: project.tts?.speed ?? 1.0,
            pitch: project.tts?.pitch ?? 0,
            audioPath: outputPath,
            audioDuration: ttsResult.audioDuration,
          };
          project.subtitle.words = ttsResult.words;

          // Generate default ASS subtitle file
          const subDir = getCategoryPath('subtitles', project._id);
          const subFileName = `sub_${Date.now()}.ass`;
          const subFilePath = path.join(subDir, subFileName);
          const assContent = generateAssFile(ttsResult.words, project.subtitle.style);
          await fs.promises.writeFile(subFilePath, assContent, 'utf-8');
          project.subtitle.path = subFilePath;

          await project.save();
        } catch (ttsErr) {
          console.error(`Batch TTS synthesis failed for project ${project._id}:`, ttsErr);
        }
      }

      if (project && project.video?.path && project.tts?.audioPath) {
        const jobId = nanoid(12);
        const quality =
          (batch.sharedConfig && typeof batch.sharedConfig === 'object' && 'quality' in batch.sharedConfig
            ? (batch.sharedConfig as any).quality
            : undefined) || 'balanced';

        const bullmqJob = await queue.add(
          'render-video',
          {
            jobId,
            projectId: project._id,
            quality,
          },
          {
            jobId,
          }
        );

        await Job.create({
          _id: jobId,
          projectId: project._id,
          bullmqJobId: bullmqJob.id,
          type: 'render',
          status: 'queued',
          progress: 0,
        });

        item.status = 'processing';
        item.error = undefined;
        queuedCount++;
      } else {
        item.status = 'error';
        item.error = !project
          ? 'Không tìm thấy dự án'
          : !project.video?.path
          ? 'Dự án chưa có video gốc'
          : 'Dự án chưa có giọng đọc TTS';
      }
    }

    if (queuedCount === 0) {
      batch.status = 'error';
      batch.completedAt = new Date();
    } else {
      batch.status = 'processing';
    }

    await batch.save();
    await batch.populate('items.projectId');

    return NextResponse.json({
      success: true,
      message: 'Đã bắt đầu xử lý hàng loạt video trong lô',
      data: batch,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Bắt đầu xử lý lô thất bại';
    console.error('Start batch processing error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
