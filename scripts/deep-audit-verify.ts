import assert from 'assert';
import path from 'path';
import fs from 'fs';
import { hexToAssColor, msToAssTime, generateAssFile } from '../src/lib/video/subtitle';
import { executeRenderPipeline } from '../src/lib/video/merge';
import ffmpeg from '../src/lib/video/ffmpeg';
import { SCRIPT_TEMPLATES, cleanScriptText } from '../src/lib/ai/prompts';
import { ai, getGeminiClient } from '../src/lib/ai/gemini';
import { edgeTTSEngine, synthesizeWithEdgeTTS } from '../src/lib/tts/edge-tts';
import { googleTTSEngine } from '../src/lib/tts/google-tts';
import { ttsEngine } from '../src/lib/tts/engine';
import { SUPPORTED_VOICES } from '../src/lib/tts/voices';
import { createRedisClient, getRedisConnectionOptions } from '../src/lib/queue/connection';
import { Project } from '../src/lib/db/models/Project';
import { Job } from '../src/lib/db/models/Job';
import { BatchGroup } from '../src/lib/db/models/BatchGroup';

async function runAuditTests() {
  console.log('--- BẮT ĐẦU KIỂM TRA TOÀN DIỆN BACKEND AUDIT ---');

  // 1. Kiểm tra Subtitle ASS Engine
  console.log('1. Kiểm tra Subtitle ASS Engine...');
  assert.strictEqual(hexToAssColor('#FFFFFF'), '&H00FFFFFF');
  assert.strictEqual(hexToAssColor('#FFD700'), '&H0000D7FF'); // Đảo RGB sang BGR
  assert.strictEqual(hexToAssColor('#FFF'), '&H00FFFFFF');     // 3-digit hex
  assert.strictEqual(msToAssTime(0), '0:00:00.00');
  assert.strictEqual(msToAssTime(65432), '0:01:05.43');

  const assOutput = generateAssFile(
    [
      { word: 'Xin', start: 100, end: 500 },
      { word: 'chào', start: 500, end: 1000 },
      { word: 'TikTok', start: 1000, end: 1800 },
    ],
    {
      fontFamily: 'Be Vietnam Pro',
      fontSize: 64,
      fontWeight: 'bold',
      primaryColor: '#FFFFFF',
      outlineColor: '#000000',
      outlineWidth: 4,
      shadowColor: '#00000080',
      shadowDepth: 2,
      position: 'bottom',
      marginBottom: 120,
      alignment: 'center',
      highlightEnabled: true,
      highlightColor: '#FFD700',
      animation: 'none',
      maxCharsPerLine: 25,
      wordsPerGroup: 3,
    }
  );

  assert.ok(assOutput.includes('PlayResX: 1080'), 'Thiếu PlayResX: 1080');
  assert.ok(assOutput.includes('PlayResY: 1920'), 'Thiếu PlayResY: 1920');
  assert.ok(assOutput.includes('WrapStyle: 0'), 'Thiếu WrapStyle: 0');
  // Kiểm tra Fix Bug Đảo Màu: PrimaryColour là vàng gold, SecondaryColour là trắng
  assert.ok(assOutput.includes('&H0000D7FF,&H00FFFFFF,&H00000000'), 'Lỗi đảo màu Primary/Secondary karaoke');
  // Kiểm tra centiseconds: (500 - 100) / 10 = 40cs
  assert.ok(assOutput.includes('{\\kf40}Xin'), 'Lỗi tính centiseconds cho \\kf');
  console.log('  ✓ Subtitle ASS Engine hoàn toàn chính xác.');

  // 2. Kiểm tra AI Prompts & Sanitizer
  console.log('2. Kiểm tra AI Prompts & Sanitizer...');
  assert.ok(ai, 'Export ai instance bị thiếu');
  assert.ok(getGeminiClient(), 'getGeminiClient() hoạt động tốt');

  const templateKeys = Object.keys(SCRIPT_TEMPLATES);
  const requiredTemplates = ['quick_review', 'unboxing', 'comparison', 'top_list', 'storytelling'];
  for (const req of requiredTemplates) {
    assert.ok(templateKeys.includes(req), `Thiếu mẫu template ${req}`);
    const tmpl = SCRIPT_TEMPLATES[req];
    assert.ok(tmpl.promptTemplate.toLowerCase().includes('emoji'), `Template ${req} chưa cấm emoji`);
    assert.ok(
      tmpl.promptTemplate.toLowerCase().includes('đạo diễn') ||
      tmpl.promptTemplate.toLowerCase().includes('cười'),
      `Template ${req} chưa cấm ghi chú đạo diễn`
    );
  }

  // Test sanitizer
  const dirtyScript = `[Hook: 3s] Chào các bạn! (cười) Đây là sản phẩm siêu cấp 🔥🔥\n\n[Body] Thử ngay nhé!`;
  const cleaned = cleanScriptText(dirtyScript);
  assert.strictEqual(cleaned, 'Chào các bạn!  Đây là sản phẩm siêu cấp\n\nThử ngay nhé!');
  console.log('  ✓ 5 template kịch bản và bộ lọc emoji/đạo diễn hoạt động hoàn hảo.');

  // 3. Kiểm tra TTS Engine Interface & Edge TTS Stdin
  console.log('3. Kiểm tra TTS Engines...');
  assert.strictEqual(typeof edgeTTSEngine.synthesize, 'function');
  assert.strictEqual(typeof edgeTTSEngine.listVoices, 'function');
  assert.strictEqual(typeof googleTTSEngine.synthesize, 'function');
  assert.strictEqual(typeof googleTTSEngine.listVoices, 'function');
  assert.strictEqual(typeof ttsEngine.synthesize, 'function');

  const edgeVoices = await edgeTTSEngine.listVoices();
  assert.ok(edgeVoices.some((v) => v.id === 'vi-VN-HoaiMyNeural'));
  assert.ok(edgeVoices.some((v) => v.id === 'vi-VN-NamMinhNeural'));

  // Test synthesizeWithEdgeTTS với stdin
  const testTtsOut = path.resolve('storage/test_audit_tts.mp3');
  const ttsRes = await synthesizeWithEdgeTTS(
    'TikVoice Studio giải pháp video tự động.',
    testTtsOut
  );
  assert.ok(fs.existsSync(ttsRes.audioPath), 'Tệp audio TTS không được tạo');
  assert.ok(ttsRes.audioDuration > 0, 'audioDuration <= 0');
  assert.ok(ttsRes.words.length > 0, 'Không trích xuất được danh sách từ');
  console.log(`  ✓ Edge TTS tạo thành công: ${ttsRes.words.length} từ, thời lượng ${ttsRes.audioDuration}s.`);

  // 4. Kiểm tra FFmpeg Render Pipeline với Subtitle & Looping
  console.log('4. Kiểm tra FFmpeg Render Pipeline...');
  const testVideo = path.resolve('storage/test_video.mp4');
  const testSub = path.resolve('storage/test_audit.ass');
  const testOut = path.resolve('storage/test_audit_rendered.mp4');
  fs.writeFileSync(testSub, assOutput, 'utf-8');

  if (!fs.existsSync(testVideo)) {
    const { execSync } = await import('child_process');
    execSync('ffmpeg -f lavfi -i color=c=black:s=1080x1920:d=1 -c:v libx264 -pix_fmt yuv420p -y storage/test_video.mp4', {
      stdio: 'ignore',
    });
  }

  let reportedPercent = 0;
  await executeRenderPipeline({
    videoPath: testVideo,
    videoDuration: 1, // thử thách loop video gốc ngắn hơn audio
    audioPath: ttsRes.audioPath,
    audioDuration: ttsRes.audioDuration,
    subtitlePath: testSub,
    subtitleEnabled: true,
    outputPath: testOut,
    quality: 'fast',
    onProgress: (pct) => {
      reportedPercent = pct;
    },
  });

  assert.ok(fs.existsSync(testOut), 'File video render thành phẩm không tồn tại');
  assert.ok(reportedPercent > 0 && reportedPercent <= 100, `Progress báo lỗi: ${reportedPercent}`);
  console.log(`  ✓ Render video thành công: ${testOut} (Progress: ${reportedPercent}%).`);

  // 5. Kiểm tra Redis & Connection Options
  console.log('5. Kiểm tra Cấu hình Redis BullMQ...');
  const connOpts = getRedisConnectionOptions();
  assert.strictEqual((connOpts as any).maxRetriesPerRequest, null, 'maxRetriesPerRequest phải là null');
  const redisClient = createRedisClient();
  assert.strictEqual(redisClient.options.maxRetriesPerRequest, null);
  redisClient.disconnect();
  console.log('  ✓ Redis connection options chuẩn BullMQ v5.');

  // 6. Kiểm tra Mongoose Models Schema
  console.log('6. Kiểm tra Mongoose Models Schema...');
  const projSchema = Project.schema;
  const statusEnum = (projSchema.path('status') as any).enumValues;
  const expectedStatuses = ['draft', 'scripted', 'voiced', 'subtitled', 'rendering', 'done', 'error'];
  assert.deepStrictEqual(statusEnum.sort(), expectedStatuses.sort(), 'Project status enum không đúng 7 trạng thái');

  const jobSchema = Job.schema;
  const jobTypes = (jobSchema.path('type') as any).enumValues;
  assert.deepStrictEqual(jobTypes.sort(), ['full_pipeline', 'render', 'subtitle', 'tts'].sort());

  console.log('  ✓ Mongoose models schemas đạt chuẩn 100%.');

  console.log('--- TẤT CẢ CÁC BÀI KIỂM TRA ĐỀU VƯỢT QUA 100%! ---');
}

runAuditTests().catch((err) => {
  console.error('TEST AUDIT THẤT BẠI:', err);
  process.exit(1);
});
