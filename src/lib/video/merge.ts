import ffmpeg from './ffmpeg';
import path from 'path';
import fs from 'fs';
import { parseResolution } from '@/lib/validation/schemas';
import { probeMedia } from './probe';
import type { VideoAspectMode, WatermarkPosition } from '@/lib/db/models/Project';

export interface RenderClipInput {
  path: string;
  duration: number;
  hasAudio?: boolean;
}

export interface DynamicRenderConfig {
  videoPath: string;
  videoDuration: number;
  videoHasAudio?: boolean;
  aspectMode?: VideoAspectMode;
  originalVolume?: number;
  clips?: RenderClipInput[];
  audioPath: string;
  audioDuration: number;
  subtitlePath?: string;
  subtitleEnabled: boolean;
  bgMusicPath?: string;
  bgMusicVolume?: number;
  bgMusicFadeIn?: number;
  bgMusicFadeOut?: number;
  bgMusicDucking?: boolean;
  watermark?: {
    enabled: boolean;
    path?: string;
    position: WatermarkPosition;
    opacity: number;
    scale: number;
  };
  outputPath: string;
  resolution?: string;
  quality: 'fast' | 'balanced' | 'high';
  onProgress?: (percent: number) => void;
  onRegisterCancel?: (killFn: () => void) => void;
}

function escapeFfmpegPath(rawPath: string): string {
  return rawPath
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:')
    .replace(/'/g, "'\\\\''");
}

function buildAspectFilter(
  inputLabel: string,
  outputLabel: string,
  width: number,
  height: number,
  aspectMode: VideoAspectMode
): string {
  if (aspectMode === 'cover') {
    return `[${inputLabel}]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1[${outputLabel}]`;
  }
  if (aspectMode === 'blur') {
    return (
      `[${inputLabel}]split=2[${inputLabel}_bg_src][${inputLabel}_fg_src];` +
      `[${inputLabel}_bg_src]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},boxblur=20:5[${inputLabel}_bg];` +
      `[${inputLabel}_fg_src]scale=${width}:${height}:force_original_aspect_ratio=decrease[${inputLabel}_fg];` +
      `[${inputLabel}_bg][${inputLabel}_fg]overlay=(W-w)/2:(H-h)/2,setsar=1[${outputLabel}]`
    );
  }
  // contain (mặc định - giữ trọn khung hình, viền đen)
  return `[${inputLabel}]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1[${outputLabel}]`;
}

function buildWatermarkOverlayCoords(position: WatermarkPosition, margin = 24): string {
  switch (position) {
    case 'top-left':
      return `${margin}:${margin}`;
    case 'bottom-left':
      return `${margin}:H-h-${margin}`;
    case 'bottom-right':
      return `W-w-${margin}:H-h-${margin}`;
    case 'top-right':
    default:
      return `W-w-${margin}:${margin}`;
  }
}

/**
 * Ghép nhiều clip B-roll thành 1 file trung gian chuẩn độ phân giải để có thể stream_loop mượt.
 * Nếu giữ âm thanh gốc (`preserveAudio`), các clip có audio được chuẩn hóa 48kHz stereo,
 * các clip không có audio được chèn luồng im lặng `anullsrc` khớp độ dài để concat đồng bộ.
 */
function prepareConcatenatedBroll(
  clips: RenderClipInput[],
  tempOutputPath: string,
  width: number,
  height: number,
  aspectMode: VideoAspectMode,
  preserveAudio: boolean
): Promise<{ duration: number; hasAudio: boolean }> {
  return new Promise((resolve, reject) => {
    let cmd = ffmpeg();
    const filters: string[] = [];
    const concatInputs: string[] = [];
    let totalDuration = 0;

    clips.forEach((clip, idx) => {
      cmd = cmd.input(clip.path);
      const clipDur = Math.max(0.1, clip.duration || 1);
      totalDuration += clipDur;
      const scaledLabel = `c${idx}`;
      filters.push(
        buildAspectFilter(`${idx}:v`, `${scaledLabel}_raw`, width, height, aspectMode),
        `[${scaledLabel}_raw]fps=30,setpts=PTS-STARTPTS[${scaledLabel}]`
      );
      concatInputs.push(`[${scaledLabel}]`);

      if (preserveAudio) {
        const audioLabel = `a${idx}`;
        if (clip.hasAudio) {
          filters.push(
            `[${idx}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,asetpts=PTS-STARTPTS[${audioLabel}]`
          );
        } else {
          filters.push(
            `anullsrc=r=48000:cl=stereo:d=${clipDur.toFixed(3)}[${audioLabel}]`
          );
        }
        concatInputs.push(`[${audioLabel}]`);
      }
    });

    if (preserveAudio) {
      filters.push(`${concatInputs.join('')}concat=n=${clips.length}:v=1:a=1[v_broll][a_broll]`);
    } else {
      filters.push(`${concatInputs.join('')}concat=n=${clips.length}:v=1:a=0[v_broll]`);
    }

    const outOpts = [
      '-map [v_broll]',
      ...(preserveAudio ? ['-map [a_broll]', '-c:a aac', '-b:a 192k'] : ['-an']),
      '-c:v libx264',
      '-preset ultrafast',
      '-crf 18',
      '-y',
    ];

    cmd
      .complexFilter(filters)
      .outputOptions(outOpts)
      .output(tempOutputPath)
      .on('end', () => resolve({ duration: Math.max(1, totalDuration), hasAudio: preserveAudio }))
      .on('error', (err) => reject(err))
      .run();
  });
}

export async function executeRenderPipeline(config: DynamicRenderConfig): Promise<void> {
  const validClips = (config.clips || []).filter((c) => c.path && fs.existsSync(c.path));
  const useMultiClip = validClips.length > 1;

  if (!useMultiClip && !fs.existsSync(config.videoPath)) {
    throw new Error(`Tệp video không tồn tại: ${config.videoPath}`);
  }
  if (!fs.existsSync(config.audioPath)) {
    throw new Error(`Tệp audio không tồn tại: ${config.audioPath}`);
  }

  const { width: targetWidth, height: targetHeight } = parseResolution(config.resolution);
  const aspectMode: VideoAspectMode = config.aspectMode || 'contain';
  const originalVol = Math.max(0, Math.min(1, config.originalVolume ?? 0));

  const outDir = path.dirname(path.resolve(config.outputPath));
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  let effectiveVideoPath = config.videoPath;
  let effectiveVideoDuration = config.videoDuration;
  let effectiveHasAudio = false;
  let tempBrollPath: string | null = null;

  if (useMultiClip) {
    const probedClips = await Promise.all(
      validClips.map(async (clip) => {
        const meta = await probeMedia(clip.path);
        return {
          path: clip.path,
          duration: meta.duration || clip.duration || 1,
          hasAudio: meta.hasAudio,
        };
      })
    );
    const shouldKeepOriginal = originalVol > 0.005 && probedClips.some((c) => c.hasAudio);
    tempBrollPath = path.join(outDir, `temp_broll_${Date.now()}.mp4`);
    const brollResult = await prepareConcatenatedBroll(
      probedClips,
      tempBrollPath,
      targetWidth,
      targetHeight,
      aspectMode,
      shouldKeepOriginal
    );
    effectiveVideoDuration = brollResult.duration;
    effectiveVideoPath = tempBrollPath;
    effectiveHasAudio = brollResult.hasAudio;
  } else {
    const singleProbe = await probeMedia(effectiveVideoPath);
    effectiveHasAudio = singleProbe.hasAudio;
    effectiveVideoDuration = singleProbe.duration || config.videoDuration;
  }

  try {
    await new Promise<void>((resolve, reject) => {
      let command = ffmpeg();

      // Input 0: Video gốc (loop nếu ngắn hơn giọng đọc TTS)
      if (effectiveVideoDuration < config.audioDuration) {
        command = command.input(effectiveVideoPath).inputOptions(['-stream_loop', '-1']);
      } else {
        command = command.input(effectiveVideoPath);
      }

      // Input 1: Audio giọng đọc TTS
      command = command.input(config.audioPath);

      let nextInputIndex = 2;
      const filterParts: string[] = [];
      let currentVideoLabel = 'v0';

      // 1. Scale / Crop / Blur nền theo aspectMode & resolution
      if (useMultiClip) {
        filterParts.push(`[0:v]setsar=1[${currentVideoLabel}]`);
      } else {
        filterParts.push(
          buildAspectFilter('0:v', currentVideoLabel, targetWidth, targetHeight, aspectMode)
        );
      }

      // 2. Xử lý âm thanh (TTS + âm thanh gốc video nếu bật + nhạc nền + ducking)
      const keepOriginalAudio = effectiveHasAudio && originalVol > 0.005;

      let voiceMixLabel = '1:a';
      if (keepOriginalAudio) {
        filterParts.push(
          `[0:a]volume=${originalVol}[orig_a]`,
          `[1:a]volume=1.0[tts_a]`,
          `[tts_a][orig_a]amix=inputs=2:duration=first:dropout_transition=2:normalize=0[voice_mix]`
        );
        voiceMixLabel = '[voice_mix]';
      }

      const hasBgMusic = Boolean(config.bgMusicPath && fs.existsSync(config.bgMusicPath));
      let audioMapOption = keepOriginalAudio ? '[voice_mix]' : '1:a';

      if (hasBgMusic) {
        const bgmIdx = nextInputIndex++;
        command = command.input(config.bgMusicPath!).inputOptions(['-stream_loop', '-1']);

        const volume = config.bgMusicVolume ?? 0.12;
        const fadeIn = config.bgMusicFadeIn ?? 2;
        const fadeOut = config.bgMusicFadeOut ?? 3;
        const actualFadeOut = Math.min(fadeOut, Math.max(0.5, config.audioDuration));
        const fadeOutStart = Math.max(0, config.audioDuration - actualFadeOut);
        const useDucking = config.bgMusicDucking ?? true;

        filterParts.push(
          `[${bgmIdx}:a]volume=${volume},afade=t=in:st=0:d=${fadeIn},afade=t=out:st=${fadeOutStart}:d=${actualFadeOut}[bgm]`
        );

        const voiceInputForMix = voiceMixLabel === '1:a' ? '[1:a]' : voiceMixLabel;
        if (useDucking) {
          filterParts.push(
            `${voiceInputForMix}asplit=2[v_main][v_sc]`,
            `[bgm][v_sc]sidechaincompress=threshold=0.025:ratio=6:attack=40:release=250[bgm_ducked]`,
            `[v_main][bgm_ducked]amix=inputs=2:duration=first:dropout_transition=2:normalize=0[a0]`
          );
        } else {
          filterParts.push(
            `${voiceInputForMix}[bgm]amix=inputs=2:duration=first:dropout_transition=2:normalize=0[a0]`
          );
        }
        audioMapOption = '[a0]';
      }

      // 3. Chèn Watermark / Logo PNG nếu bật
      const hasWatermark = Boolean(
        config.watermark?.enabled &&
          config.watermark?.path &&
          fs.existsSync(config.watermark.path)
      );
      if (hasWatermark && config.watermark?.path) {
        const wmIdx = nextInputIndex++;
        command = command.input(config.watermark.path);

        const wmWidth = Math.max(48, Math.round(targetWidth * (config.watermark.scale ?? 0.16)));
        const wmOpacity = Math.max(0.1, Math.min(1, config.watermark.opacity ?? 0.85));
        const coords = buildWatermarkOverlayCoords(config.watermark.position || 'top-right');

        filterParts.push(
          `[${wmIdx}:v]scale=${wmWidth}:-1,format=rgba,colorchannelmixer=aa=${wmOpacity}[wm]`,
          `[${currentVideoLabel}][wm]overlay=${coords}[vwm]`
        );
        currentVideoLabel = 'vwm';
      }

      // 4. Burn phụ đề ASS kèm fontsdir
      const hasSubtitle = Boolean(
        config.subtitleEnabled && config.subtitlePath && fs.existsSync(config.subtitlePath)
      );
      if (hasSubtitle && config.subtitlePath) {
        const normalizedPath = escapeFfmpegPath(config.subtitlePath);
        const fontsDir = escapeFfmpegPath(path.resolve('public/fonts'));

        filterParts.push(
          `[${currentVideoLabel}]ass='${normalizedPath}':fontsdir='${fontsDir}'[vout]`
        );
        currentVideoLabel = 'vout';
      }

      const qualityMap = {
        fast: { preset: 'ultrafast', crf: 28 },
        balanced: { preset: 'medium', crf: 23 },
        high: { preset: 'slow', crf: 18 },
      };
      const { preset, crf } = qualityMap[config.quality] || qualityMap.balanced;

      const renderDuration =
        config.audioDuration && config.audioDuration > 0
          ? config.audioDuration
          : effectiveVideoDuration || 30;

      if (config.onRegisterCancel) {
        config.onRegisterCancel(() => {
          try {
            command.kill('SIGKILL');
          } catch {
            // ignore kill error
          }
        });
      }

      command
        .complexFilter(filterParts)
        .outputOptions([
          `-map [${currentVideoLabel}]`,
          `-map ${audioMapOption}`,
          '-c:v libx264',
          '-pix_fmt yuv420p',
          '-r 30',
          `-preset ${preset}`,
          `-crf ${crf}`,
          '-c:a aac',
          '-b:a 192k',
          `-t ${renderDuration}`,
          '-movflags +faststart',
          '-y',
        ])
        .output(config.outputPath)
        .on('progress', (p) => {
          if (!config.onProgress) return;
          let calculatedPercent =
            typeof p.percent === 'number' && !isNaN(p.percent) ? p.percent : 0;
          if (p.timemark && renderDuration > 0) {
            const parts = p.timemark.split(':');
            if (parts.length === 3) {
              const secs =
                parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
              if (!isNaN(secs)) {
                calculatedPercent = (secs / renderDuration) * 100;
              }
            }
          }
          config.onProgress(Math.min(100, Math.max(0, Math.round(calculatedPercent))));
        })
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  } finally {
    if (tempBrollPath && fs.existsSync(tempBrollPath)) {
      await fs.promises.unlink(tempBrollPath).catch(() => {});
    }
  }
}
