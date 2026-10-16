import { Worker, Job as BullJob } from 'bullmq';
import fs from 'fs';
import path from 'path';
import { getRedisConnectionOptions } from '../src/lib/queue/connection';
import { VIDEO_QUEUE_NAME } from '../src/lib/queue/queues';
import { connectDB } from '../src/lib/db';
import { Project } from '../src/lib/db/models/Project';
import { Job as JobModel } from '../src/lib/db/models/Job';
import { BatchGroup } from '../src/lib/db/models/BatchGroup';
import { executeRenderPipeline } from '../src/lib/video/merge';
import { generateAssFile } from '../src/lib/video/subtitle';
import { getCategoryPath } from '../src/lib/storage/local';

interface VideoJobData {
  jobId: string;
  projectId: string;
  quality?: 'fast' | 'balanced' | 'high';
}

const connection = getRedisConnectionOptions();
const concurrency = Number(process.env.MAX_CONCURRENT_RENDERS) || 1;

console.log(`[Worker] Khởi chạy Video Worker với concurrency = ${concurrency}...`);

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
          if (errorMessage) {
            item.error = errorMessage;
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
          // If concurrent update occurred, reload and re-apply
          const freshBatch = await BatchGroup.findById(batch._id);
          if (freshBatch) {
            for (const item of freshBatch.items) {
              if (item.projectId?.toString() === projectId) {
                item.status = itemStatus;
                if (errorMessage) item.error = errorMessage;
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

async function startWorker() {
  await connectDB();
  console.log('[Worker] Đã kết nối thành công với MongoDB');

  const worker = new Worker<VideoJobData>(
    VIDEO_QUEUE_NAME,
    async (bullJob: BullJob<VideoJobData>) => {
      await connectDB();
      const { jobId, projectId, quality = 'balanced' } = bullJob.data;
      console.log(`[Worker] Bắt đầu xử lý Job ${jobId} cho Project ${projectId}...`);

      const dbJob = await JobModel.findById(jobId);
      const project = await Project.findById(projectId);

      if (!project) {
        throw new Error(`Không tìm thấy Project với id: ${projectId}`);
      }

      if (dbJob) {
        dbJob.status = 'processing';
        dbJob.progress = 5;
        await dbJob.save();
      }

      project.status = 'rendering';
      await project.save();

      // Cập nhật trạng thái item trong lô batch (nếu có) sang processing
      await updateBatchGroupOnJobStatus(projectId, 'processing');

      try {
        // 1. Kiểm tra Video gốc
        if (!project.video?.path || !fs.existsSync(project.video.path)) {
          throw new Error('Video gốc không tồn tại hoặc chưa được tải lên');
        }

        // 2. Kiểm tra Audio giọng đọc
        if (!project.tts?.audioPath || !fs.existsSync(project.tts.audioPath)) {
          throw new Error('Tệp giọng đọc TTS không tồn tại. Vui lòng tạo giọng đọc trước.');
        }

        // 3. Chuẩn bị file Subtitle ASS nếu được bật
        let subtitlePath = project.subtitle?.path;
        const subtitleEnabled = project.subtitle?.enabled ?? true;

        if (subtitleEnabled && project.subtitle?.words?.length > 0) {
          const subDir = getCategoryPath('subtitles', projectId);
          subtitlePath = path.join(subDir, `sub_${Date.now()}.ass`);
          const assContent = generateAssFile(project.subtitle.words, project.subtitle.style);
          await fs.promises.writeFile(subtitlePath, assContent, 'utf-8');
          project.subtitle.path = subtitlePath;
          await project.save();
        }

        // 4. Chuẩn bị đường dẫn xuất file
        const exportsDir = getCategoryPath('exports', projectId);
        const outputFileName = `tikvoice_${projectId}_${Date.now()}.mp4`;
        const outputPath = path.join(exportsDir, outputFileName);

        let lastLoggedProgress = -1;
        let lastDbSaveTime = 0;

        // 5. Tiến hành render bằng FFmpeg
        await executeRenderPipeline({
          videoPath: project.video.path,
          videoDuration: project.video.duration || 30,
          audioPath: project.tts.audioPath,
          audioDuration: project.tts.audioDuration || 30,
          subtitlePath: subtitleEnabled ? subtitlePath : undefined,
          subtitleEnabled: subtitleEnabled && Boolean(subtitlePath),
          bgMusicPath: project.bgMusic?.path,
          bgMusicVolume: project.bgMusic?.volume,
          bgMusicFadeIn: project.bgMusic?.fadeIn,
          bgMusicFadeOut: project.bgMusic?.fadeOut,
          outputPath,
          quality,
          onProgress: async (percent) => {
            bullJob.updateProgress(percent);
            const now = Date.now();
            if (
              percent !== lastLoggedProgress &&
              (percent - lastLoggedProgress >= 2 || now - lastDbSaveTime > 1000 || percent === 100)
            ) {
              lastLoggedProgress = percent;
              lastDbSaveTime = now;
              await JobModel.updateOne({ _id: jobId }, { $set: { progress: percent } }).catch(() => {});
            }
          },
        });

        // 6. Cập nhật thông tin xuất video
        const stats = await fs.promises.stat(outputPath);
        project.status = 'done';
        project.export = {
          path: outputPath,
          resolution: '1080x1920',
          quality,
          fileSize: stats.size,
        };
        await project.save();

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
                url: `/api/files/exports/${projectId}/${outputFileName}`,
              },
            },
          }
        ).catch(() => {});

        // Cập nhật trạng thái item trong lô batch (nếu có) sang done
        await updateBatchGroupOnJobStatus(projectId, 'done');

        console.log(`[Worker] Hoàn thành Job ${jobId} cho Project ${projectId}!`);
        return {
          outputPath,
          fileSize: stats.size,
        };
      } catch (err: unknown) {
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
      if (dbJob && dbJob.status !== 'error') {
        dbJob.status = 'error';
        dbJob.error = err.message;
        await dbJob.save().catch(() => {});
      }
      const project = await Project.findById(projectId);
      if (project && project.status !== 'error') {
        project.status = 'error';
        await project.save().catch(() => {});
      }
      await updateBatchGroupOnJobStatus(projectId, 'error', err.message);
    }
  });
}

startWorker().catch((err) => {
  console.error('[Worker] Lỗi khởi động worker:', err);
  process.exit(1);
});

