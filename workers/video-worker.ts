import { Worker, Job as BullJob } from 'bullmq';
import fs from 'fs';
import path from 'path';
import { createRedisClient, getRedisConnectionOptions } from '../src/lib/queue/connection';
import { getVideoQueue, VIDEO_QUEUE_NAME } from '../src/lib/queue/queues';
import { connectDB } from '../src/lib/db';
import { Project, IProject } from '../src/lib/db/models/Project';
import { Job as JobModel } from '../src/lib/db/models/Job';
import { BatchGroup } from '../src/lib/db/models/BatchGroup';
import { executeRenderPipeline } from '../src/lib/video/merge';
import { generateAssFile } from '../src/lib/video/subtitle';
import { generateVideoThumbnail } from '../src/lib/video/probe';
import { getCategoryPath, safeUnlinkStorageFile } from '../src/lib/storage/local';
import { generateProductScript } from '../src/lib/ai/prompts';
import { ttsEngine } from '../src/lib/tts/engine';
import { parseResolution } from '../src/lib/validation/schemas';

interface VideoJobData {
  jobId: string;
  projectId: string;
  type?: 'render' | 'full_pipeline';
  quality?: 'fast' | 'balanced' | 'high';
  resolution?: string;
}

const connection = getRedisConnectionOptions();
const redisClient = createRedisClient();
const concurrency = Number(process.env.MAX_CONCURRENT_RENDERS) || 1;

console.log(`[Worker] Khởi chạy Video Worker với concurrency = ${concurrency}...`);

function getCancelKey(jobId: string): string {
  return `tikvoice:cancel:${jobId}`;
}

async function isJobCancelled(jobId: string): Promise<boolean> {
  try {
    const val = await redisClient.get(getCancelKey(jobId));
    if (val === '1') return true;
  } catch {
    // fallback check DB
  }
  const dbJob = await JobModel.findById(jobId).select('status').lean();
  return dbJob?.status === 'cancelled';
}

function getFallbackProjectStatus(project: IProject): IProject['status'] {
  if (project.export?.path && fs.existsSync(project.export.path)) return 'done';
  if (project.subtitle?.words?.length > 0) return 'subtitled';
  if (project.tts?.audioPath) return 'voiced';
  if (project.script?.text) return 'scripted';
  return 'draft';
}

async function updateBatchGroupOnJobStatus(
  projectId: string,
  itemStatus: 'processing' | 'done' | 'error',
  errorMessage?: string
) {
  try {
    const batches = await BatchGroup.find({ 'items.projectId': projectId });
    for (const batch of batches) {
      let updated = false;
      for (const item of batch.items) {
        if (item.projectId?.toString() === projectId) {
          item.status = itemStatus;
          if (itemStatus === 'error' && errorMessage) {
            item.error = errorMessage;
          } else if (itemStatus !== 'error') {
            item.error = undefined;
          }
          updated = true;
        }
      }
      if (updated) {
        const allFinished = batch.items.every(
          (i) => i.status === 'done' || i.status === 'error'
        );
        if (allFinished) {
          const anyError = batch.items.some((i) => i.status === 'error');
          batch.status = anyError ? 'error' : 'done';
          batch.completedAt = new Date();
        } else {
          batch.status = 'processing';
        }

        try {
          await batch.save();
        } catch {
          const freshBatch = await BatchGroup.findById(batch._id);
          if (freshBatch) {
            for (const item of freshBatch.items) {
              if (item.projectId?.toString() === projectId) {
                item.status = itemStatus;
                if (itemStatus === 'error' && errorMessage) item.error = errorMessage;
                else if (itemStatus !== 'error') item.error = undefined;
              }
            }
            const freshAllFinished = freshBatch.items.every(
              (i) => i.status === 'done' || i.status === 'error'
            );
            freshBatch.status = freshAllFinished
              ? freshBatch.items.some((i) => i.status === 'error')
                ? 'error'
                : 'done'
              : 'processing';
            if (freshAllFinished) freshBatch.completedAt = new Date();
            await freshBatch.save().catch(() => {});
          }
        }
      }
    }
  } catch (err) {
    console.error('[Worker] Lỗi cập nhật BatchGroup:', err);
  }
}

/**
 * Khôi phục các Job hoặc Project bị kẹt trạng thái rendering/processing nếu Worker từng bị tắt đột ngột.
 */
async function recoverStuckJobsOnStartup() {
  try {
    const queue = getVideoQueue();
    const stuckJobs = await JobModel.find({ status: { $in: ['queued', 'processing'] } });

    for (const dbJob of stuckJobs) {
      const bJob = dbJob.bullmqJobId ? await queue.getJob(dbJob.bullmqJobId) : null;
      const bState = bJob ? await bJob.getState() : 'missing';

      if (bState === 'waiting' || bState === 'delayed' || bState === 'active') {
        continue;
      }

      dbJob.status = 'error';
      dbJob.error = 'Tiến trình xử lý bị gián đoạn do máy chủ khởi động lại.';
      await dbJob.save().catch(() => {});

      const project = await Project.findById(dbJob.projectId);
      if (project && project.status === 'rendering') {
        project.status = getFallbackProjectStatus(project);
        await project.save().catch(() => {});
      }

      await updateBatchGroupOnJobStatus(dbJob.projectId, 'error', dbJob.error);
    }

    // Dọn các project bị kẹt rendering nhưng không còn job nào đang chạy
    const stuckProjects = await Project.find({ status: 'rendering' });
    for (const proj of stuckProjects) {
      const hasActive = await JobModel.exists({
        projectId: proj._id,
        status: { $in: ['queued', 'processing'] },
      });
      if (!hasActive) {
        proj.status = getFallbackProjectStatus(proj);
        await proj.save().catch(() => {});
      }
    }
  } catch (err) {
    console.error('[Worker] Lỗi khôi phục job kẹt:', err);
  }
}

async function startWorker() {
  await connectDB();
  console.log('[Worker] Đã kết nối thành công với MongoDB');
  await recoverStuckJobsOnStartup();

  const worker = new Worker<VideoJobData>(
    VIDEO_QUEUE_NAME,
    async (bullJob: BullJob<VideoJobData>) => {
      await connectDB();
      const {
        jobId,
        projectId,
        type = 'render',
        quality: jobQuality,
        resolution: jobResolution,
      } = bullJob.data;

      console.log(`[Worker] Bắt đầu xử lý Job ${jobId} (${type}) cho Project ${projectId}...`);

      const dbJob = await JobModel.findById(jobId);
      const project = await Project.findById(projectId);

      if (!project) {
        throw new Error(`Không tìm thấy Project với id: ${projectId}`);
      }

      if (await isJobCancelled(jobId)) {
        project.status = getFallbackProjectStatus(project);
        await project.save().catch(() => {});
        return { cancelled: true };
      }

      if (dbJob) {
        dbJob.status = 'processing';
        dbJob.progress = 5;
        await dbJob.save();
      }

      project.status = 'rendering';
      await project.save();
      await updateBatchGroupOnJobStatus(projectId, 'processing');

      let killFfmpeg: (() => void) | null = null;
      let wasCancelled = false;

      try {
        if (!project.video?.path || !fs.existsSync(project.video.path)) {
          throw new Error('Video gốc không tồn tại hoặc chưa được tải lên');
        }

        // Full Pipeline (dùng cho Batch Studio chạy ngầm hoàn toàn trên Worker)
        if (type === 'full_pipeline') {
          if (!project.script?.text?.trim()) {
            if (!project.script?.productName?.trim()) {
              throw new Error('Thiếu kịch bản và tên sản phẩm để AI viết kịch bản tự động.');
            }
            const generatedText = await generateProductScript({
              productName: project.script.productName,
              productInfo: project.script.productInfo || '',
              templateId: project.script.templateId || 'quick_review',
              customInstructions: project.script.customInstructions,
            });
            if (!generatedText.trim()) {
              throw new Error('Gemini AI không trả về nội dung kịch bản hợp lệ.');
            }
            project.script.text = generatedText;
            await project.save();
          }

          await JobModel.updateOne({ _id: jobId }, { $set: { progress: 18 } }).catch(() => {});

          if (await isJobCancelled(jobId)) {
            wasCancelled = true;
            throw new Error('Tác vụ đã bị hủy bởi người dùng.');
          }

          const needsTts =
            !project.tts?.audioPath ||
            !fs.existsSync(project.tts.audioPath) ||
            (project.tts.sourceText &&
              project.tts.sourceText.trim() !== project.script.text.trim() &&
              !project.tts.isCustomAudio);

          if (needsTts) {
            const oldAudio = project.tts?.audioPath;
            const audioDir = getCategoryPath('audio', projectId);
            const audioFileName = `speech_${Date.now()}.mp3`;
            const audioOutputPath = path.join(audioDir, audioFileName);

            const ttsResult = await ttsEngine.synthesize(project.script.text, audioOutputPath, {
              voice: project.tts?.voice || 'vi-VN-HoaiMyNeural',
              speed: project.tts?.speed ?? 1.0,
              pitch: project.tts?.pitch ?? 0,
              engine: project.tts?.engine || 'edge',
            });

            project.tts = {
              engine: ttsResult.actualEngine || project.tts?.engine || 'edge',
              voice: ttsResult.actualVoice || project.tts?.voice || 'vi-VN-HoaiMyNeural',
              speed: project.tts?.speed ?? 1.0,
              pitch: project.tts?.pitch ?? 0,
              audioPath: audioOutputPath,
              audioDuration: ttsResult.audioDuration,
              sourceText: project.script.text.trim(),
              isCustomAudio: false,
            };
            project.subtitle.words = ttsResult.words;
            await project.save();

            if (oldAudio && oldAudio !== audioOutputPath) {
              await safeUnlinkStorageFile(oldAudio);
            }
          }

          await JobModel.updateOne({ _id: jobId }, { $set: { progress: 35 } }).catch(() => {});
        }

        if (!project.tts?.audioPath || !fs.existsSync(project.tts.audioPath)) {
          throw new Error('Tệp giọng đọc TTS không tồn tại. Vui lòng tạo giọng đọc trước.');
        }

        if (await isJobCancelled(jobId)) {
          wasCancelled = true;
          throw new Error('Tác vụ đã bị hủy bởi người dùng.');
        }

        // Chuẩn bị file Subtitle ASS nếu được bật
        const oldSubtitlePath = project.subtitle?.path;
        let subtitlePath = project.subtitle?.path;
        const subtitleEnabled = project.subtitle?.enabled ?? true;

        if (subtitleEnabled && project.subtitle?.words?.length > 0) {
          const subDir = getCategoryPath('subtitles', projectId);
          subtitlePath = path.join(subDir, `sub_${Date.now()}.ass`);
          const assContent = generateAssFile(project.subtitle.words, project.subtitle.style);
          await fs.promises.writeFile(subtitlePath, assContent, 'utf-8');
          project.subtitle.path = subtitlePath;
          await project.save();
          if (oldSubtitlePath && oldSubtitlePath !== subtitlePath) {
            await safeUnlinkStorageFile(oldSubtitlePath);
          }
        }

        // Chuẩn bị độ phân giải, chất lượng và đường dẫn xuất
        const quality = jobQuality || project.export?.quality || 'balanced';
        const { key: resolvedResolution } = parseResolution(
          jobResolution || project.export?.resolution
        );

        const oldExportPath = project.export?.path;
        const oldExportThumb = project.export?.thumbnailPath;
        const exportsDir = getCategoryPath('exports', projectId);
        const outputFileName = `tikvoice_${projectId}_${Date.now()}.mp4`;
        const outputPath = path.join(exportsDir, outputFileName);

        let lastLoggedProgress = -1;
        let lastDbSaveTime = 0;
        let lastCancelCheck = 0;

        await executeRenderPipeline({
          videoPath: project.video.path,
          videoDuration: project.video.duration || 30,
          videoHasAudio: project.video.hasAudio ?? false,
          aspectMode: project.video.aspectMode || 'contain',
          originalVolume: project.video.originalVolume ?? 0,
          clips: project.video.clips?.map((c) => ({
            path: c.path,
            duration: c.duration,
            hasAudio: c.hasAudio,
          })),
          audioPath: project.tts.audioPath,
          audioDuration: project.tts.audioDuration || 30,
          subtitlePath: subtitleEnabled ? subtitlePath : undefined,
          subtitleEnabled: subtitleEnabled && Boolean(subtitlePath),
          bgMusicPath: project.bgMusic?.path,
          bgMusicVolume: project.bgMusic?.volume,
          bgMusicFadeIn: project.bgMusic?.fadeIn,
          bgMusicFadeOut: project.bgMusic?.fadeOut,
          bgMusicDucking: project.bgMusic?.ducking ?? true,
          watermark: project.watermark?.enabled
            ? {
                enabled: true,
                path: project.watermark.path,
                position: project.watermark.position || 'top-right',
                opacity: project.watermark.opacity ?? 0.85,
                scale: project.watermark.scale ?? 0.16,
              }
            : undefined,
          outputPath,
          resolution: resolvedResolution,
          quality,
          onRegisterCancel: (fn) => {
            killFfmpeg = fn;
          },
          onProgress: async (percent) => {
            const scaledPercent =
              type === 'full_pipeline' ? Math.round(35 + percent * 0.6) : percent;

            bullJob.updateProgress(scaledPercent);
            const now = Date.now();

            if (now - lastCancelCheck > 1000) {
              lastCancelCheck = now;
              if (await isJobCancelled(jobId)) {
                wasCancelled = true;
                if (killFfmpeg) killFfmpeg();
                return;
              }
            }

            if (
              scaledPercent !== lastLoggedProgress &&
              (scaledPercent - lastLoggedProgress >= 2 ||
                now - lastDbSaveTime > 1000 ||
                scaledPercent === 100)
            ) {
              lastLoggedProgress = scaledPercent;
              lastDbSaveTime = now;
              await JobModel.updateOne(
                { _id: jobId },
                { $set: { progress: scaledPercent } }
              ).catch(() => {});
            }
          },
        });

        if (wasCancelled || (await isJobCancelled(jobId))) {
          await safeUnlinkStorageFile(outputPath);
          project.status = getFallbackProjectStatus(project);
          await project.save().catch(() => {});
          return { cancelled: true };
        }

        // Trích xuất ảnh thumbnail cho video xuất
        const thumbName = `thumb_export_${Date.now()}.jpg`;
        const thumbPath = path.join(exportsDir, thumbName);
        const createdThumb = await generateVideoThumbnail(outputPath, thumbPath, 0.5);

        const stats = await fs.promises.stat(outputPath);
        project.status = 'done';
        project.export = {
          path: outputPath,
          resolution: resolvedResolution,
          quality,
          fileSize: stats.size,
          thumbnailPath: createdThumb || undefined,
        };
        await project.save();

        // Dọn file export cũ
        if (oldExportPath && oldExportPath !== outputPath) {
          await safeUnlinkStorageFile(oldExportPath);
        }
        if (oldExportThumb && oldExportThumb !== createdThumb) {
          await safeUnlinkStorageFile(oldExportThumb);
        }

        await JobModel.updateOne(
          { _id: jobId },
          {
            $set: {
              status: 'done',
              progress: 100,
              completedAt: new Date(),
              result: {
                exportPath: outputPath,
                fileSize: stats.size,
                resolution: resolvedResolution,
                url: `/api/files/exports/${projectId}/${outputFileName}`,
              },
            },
          }
        ).catch(() => {});

        await updateBatchGroupOnJobStatus(projectId, 'done');

        console.log(`[Worker] Hoàn thành Job ${jobId} cho Project ${projectId}!`);
        return {
          outputPath,
          fileSize: stats.size,
        };
      } catch (err: unknown) {
        if (wasCancelled || (await isJobCancelled(jobId))) {
          project.status = getFallbackProjectStatus(project);
          await project.save().catch(() => {});
          await JobModel.updateOne(
            { _id: jobId },
            { $set: { status: 'cancelled', cancelledAt: new Date() } }
          ).catch(() => {});
          return { cancelled: true };
        }

        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[Worker] Lỗi xử lý Job ${jobId} cho Project ${projectId}:`, err);

        project.status = 'error';
        await project.save().catch(() => {});

        await JobModel.updateOne(
          { _id: jobId },
          {
            $set: {
              status: 'error',
              error: errorMsg,
            },
          }
        ).catch(() => {});

        await updateBatchGroupOnJobStatus(projectId, 'error', errorMsg);
        throw err;
      }
    },
    {
      connection,
      concurrency,
    }
  );

  worker.on('failed', async (bullJob, err) => {
    console.error(`[Worker] Job ${bullJob?.id} thất bại:`, err);
    if (bullJob?.data) {
      const { jobId, projectId } = bullJob.data;
      const dbJob = await JobModel.findById(jobId);
      if (dbJob && dbJob.status !== 'error' && dbJob.status !== 'cancelled') {
        dbJob.status = 'error';
        dbJob.error = err.message;
        await dbJob.save().catch(() => {});
      }
      if (dbJob?.status !== 'cancelled') {
        const project = await Project.findById(projectId);
        if (project && project.status !== 'error') {
          project.status = 'error';
          await project.save().catch(() => {});
        }
        await updateBatchGroupOnJobStatus(projectId, 'error', err.message);
      }
    }
  });
}

startWorker().catch((err) => {
  console.error('[Worker] Lỗi khởi động worker:', err);
  process.exit(1);
});
