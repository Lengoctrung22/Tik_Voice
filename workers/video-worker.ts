import { Worker, Job as BullJob } from 'bullmq';
import fs from 'fs';
import path from 'path';
import { getRedisConnectionOptions } from '../src/lib/queue/connection';
import { VIDEO_QUEUE_NAME } from '../src/lib/queue/queues';
import { connectDB } from '../src/lib/db';
import { Project } from '../src/lib/db/models/Project';
import { Job as JobModel } from '../src/lib/db/models/Job';
import { executeRenderPipeline } from '../src/lib/video/merge';
import { generateAssFile } from '../src/lib/video/subtitle';
import { getCategoryPath } from '../src/lib/storage/local';

interface VideoJobData {
  jobId: string;
  projectId: string;
  quality?: 'fast' | 'balanced' | 'high';
}

const connection = getRedisConnectionOptions();
const concurrency = parseInt(process.env.MAX_CONCURRENT_RENDERS || '1', 10);

console.log(`[Worker] Khởi chạy Video Worker với concurrency = ${concurrency}...`);

async function startWorker() {
  await connectDB();
  console.log('[Worker] Đã kết nối thành công với MongoDB');

  const worker = new Worker<VideoJobData>(
    VIDEO_QUEUE_NAME,
    async (bullJob: BullJob<VideoJobData>) => {
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
          if (dbJob) {
            dbJob.progress = percent;
            await dbJob.save().catch(() => {});
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

      if (dbJob) {
        dbJob.status = 'done';
        dbJob.progress = 100;
        dbJob.completedAt = new Date();
        dbJob.result = {
          exportPath: outputPath,
          fileSize: stats.size,
          url: `/api/files/exports/${projectId}/${outputFileName}`,
        };
        await dbJob.save();
      }

      console.log(`[Worker] Hoàn thành Job ${jobId} cho Project ${projectId}!`);
      return {
        outputPath,
        fileSize: stats.size,
      };
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
      if (dbJob) {
        dbJob.status = 'error';
        dbJob.error = err.message;
        await dbJob.save().catch(() => {});
      }
      const project = await Project.findById(projectId);
      if (project) {
        project.status = 'error';
        await project.save().catch(() => {});
      }
    }
  });
}

startWorker().catch((err) => {
  console.error('[Worker] Lỗi khởi động worker:', err);
  process.exit(1);
});
