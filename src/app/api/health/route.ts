import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import { connectDB } from '@/lib/db';
import { getRedisConnectionOptions } from '@/lib/queue/connection';
import { getStorageUsageStats } from '@/lib/storage/local';

const execFileAsync = promisify(execFile);

interface ServiceCheckResult {
  ok: boolean;
  label: string;
  detail: string;
}

async function checkMongo(): Promise<ServiceCheckResult> {
  try {
    await connectDB();
    await mongoose.connection.db?.admin().ping();
    return { ok: true, label: 'MongoDB', detail: 'Đã kết nối' };
  } catch (error: unknown) {
    return {
      ok: false,
      label: 'MongoDB',
      detail: error instanceof Error ? error.message : 'Không thể kết nối MongoDB',
    };
  }
}

async function checkRedis(): Promise<ServiceCheckResult> {
  const opts = getRedisConnectionOptions();
  const host = 'host' in opts && typeof opts.host === 'string' ? opts.host : 'localhost';
  const port = 'port' in opts && typeof opts.port === 'number' ? opts.port : 6379;
  const password = 'password' in opts && typeof opts.password === 'string' ? opts.password : undefined;

  const client = new Redis({
    host,
    port,
    password,
    lazyConnect: true,
    connectTimeout: 1200,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });

  // Tránh unhandled error event từ ioredis
  client.on('error', () => {});

  try {
    await Promise.race([
      (async () => {
        await client.connect();
        await client.ping();
      })(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Hết thời gian kết nối Redis (1.5s)')), 1500)
      ),
    ]);
    return { ok: true, label: 'Hàng đợi xử lý nền (Redis)', detail: `${host}:${port}` };
  } catch (error: unknown) {
    return {
      ok: false,
      label: 'Hàng đợi xử lý nền (Redis)',
      detail:
        error instanceof Error
          ? error.message
          : `Không kết nối được ${host}:${port}`,
    };
  } finally {
    client.disconnect();
  }
}

async function checkBinary(bin: string, args: string[], label: string): Promise<ServiceCheckResult> {
  try {
    const { stdout } = await execFileAsync(bin, args, { timeout: 3000 });
    const firstLine = stdout.split(/\r?\n/)[0]?.trim() || 'Sẵn sàng';
    return { ok: true, label, detail: firstLine };
  } catch {
    return { ok: false, label, detail: `Không tìm thấy ${bin} trong PATH` };
  }
}

async function checkEdgeTts(): Promise<ServiceCheckResult> {
  const pythonBin = process.env.PYTHON_PATH || 'python';
  try {
    await execFileAsync(pythonBin, ['-c', 'import edge_tts; print("ok")'], { timeout: 4000 });
    return { ok: true, label: 'Edge TTS (Python)', detail: 'Đã cài đặt thư viện edge_tts' };
  } catch {
    return { ok: false, label: 'Edge TTS (Python)', detail: 'Chưa cài đặt gói edge-tts trong Python' };
  }
}

export async function GET() {
  const [mongo, redis, ffmpeg, ffprobe, edgeTts, storage] = await Promise.all([
    checkMongo(),
    checkRedis(),
    checkBinary('ffmpeg', ['-version'], 'FFmpeg'),
    checkBinary('ffprobe', ['-version'], 'FFprobe'),
    checkEdgeTts(),
    getStorageUsageStats(),
  ]);

  const geminiOk = Boolean(process.env.GEMINI_API_KEY?.trim());
  const googleCredsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  const googleOk = Boolean(googleCredsPath && fs.existsSync(googleCredsPath));

  const services = {
    mongo,
    redis,
    ffmpeg,
    ffprobe,
    edgeTts,
    gemini: {
      ok: geminiOk,
      label: 'Gemini AI',
      detail: geminiOk ? 'Đã cấu hình GEMINI_API_KEY' : 'Chưa thiết lập GEMINI_API_KEY',
    },
    googleTts: {
      ok: googleOk,
      label: 'Google Cloud TTS',
      detail: googleOk
        ? 'Đã cấu hình tệp chứng thực'
        : googleCredsPath
        ? 'Không tìm thấy tệp JSON chứng thực'
        : 'Chưa bật (đang dùng Edge TTS miễn phí)',
    },
  };

  const coreOk = mongo.ok && ffmpeg.ok && ffprobe.ok;

  return NextResponse.json({
    success: true,
    data: {
      ok: coreOk,
      readyForQueue: coreOk && redis.ok,
      services,
      storage,
      checkedAt: new Date().toISOString(),
    },
  });
}
