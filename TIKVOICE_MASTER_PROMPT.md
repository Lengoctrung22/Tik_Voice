# 🎬 MASTER PROMPT: TIKVOICE — AI VIDEO VOICE-OVER STUDIO (ULTIMATE PRODUCTION SPEC)

> **Hướng dẫn sử dụng**: Copy toàn bộ nội dung prompt bên dưới vào Cursor, Windsurf, Claude Code, ChatGPT hoặc Antigravity. Bản đặc tả này là phiên bản hợp nhất hoàn chỉnh nhất, đã sửa triệt để mọi bug kỹ thuật và tối ưu sẵn sàng cho môi trường Production trên VPS Docker.

---

```markdown
# ROLE & MISSION
Bạn là một Senior Full-Stack & AI Systems Architect. Nhiệm vụ của bạn là lập trình hoàn chỉnh từ A đến Z một ứng dụng Web Application mang tên **"TikVoice"** — Công cụ tự động hóa lồng tiếng, tạo phụ đề karaoke động và biên tập video phục vụ TikTok Affiliate Marketing.

Ứng dụng chạy ở chế độ **Self-hosted / Single-user** trên VPS riêng (Ubuntu + Docker), không yêu cầu multi-tenant hay authentication phức tạp, ưu tiên tốc độ xử lý video, độ tin cậy của hàng đợi và trải nghiệm người dùng mượt mà.

---

## 1. TỔNG QUAN KIẾN TRÚC & TECH STACK

### 1.1 Technology Stack Chi Tiết
- **Runtime**: Node.js 22 LTS (ESM Native)
- **Framework**: Next.js 15+ (App Router, Server Actions & Route Handlers)
  - **Quy tắc Next.js 15**: `params` và `searchParams` trong mọi `page.tsx` và `route.ts` đều là bất đồng bộ (`Promise<{ id: string }>`), bắt buộc phải dùng `const { id } = await params;`.
  - Cấu hình `next.config.ts`: bắt buộc khai báo `serverExternalPackages: ['mongoose', 'bullmq', 'ioredis', 'fluent-ffmpeg', 'archiver']`.
- **Language**: TypeScript 5.5+ (Strict mode)
- **UI & Styling**: Tailwind CSS v4, shadcn/ui, Lucide React, Sonner (Toaster)
- **State Management**: Zustand v5
- **Database**: **MongoDB 7+** (Official Image qua Docker)
- **ODM**: **Mongoose v8+** (với connection pooling và cache model cho Next.js App Router)
- **Task Queue / Background Jobs**: BullMQ v5 + Redis 7 (Alpine)
- **Text-to-Speech (TTS)**:
  - Free Engine (Mặc định): Python `edge-tts` CLI hoặc `msedge-tts` (Microsoft Edge Neural Voices tiếng Việt: Hoài My, Nam Minh, trích xuất chính xác WordBoundary timestamps).
  - Premium Engine (Tùy chọn): `@google-cloud/text-to-speech` (WaveNet / Neural2).
- **AI Scriptwriter**: Google Gemini API (`@google/genai` với cú pháp SDK mới và model `gemini-2.0-flash`).
- **Video & Audio Processing**: FFmpeg 6+ (System binary) qua thư viện `fluent-ffmpeg`.
- **Subtitle Engine**: Advanced SubStation Alpha (`.ass`) chuẩn 1080p với hiệu ứng Karaoke Word Highlight (`\kf`).
- **Archive & Export**: `archiver` cho việc nén zip hàng loạt video.
- **Deployment**: Docker Compose (gồm 4 services: `app`, `worker`, `redis`, `mongo`).

### 1.2 Dependencies Cần Thiết (`package.json`)
> **Lưu ý sống còn**: `tsx` phải nằm trong `dependencies` (không được để ở `devDependencies`) để container `worker` chạy lệnh `node --import tsx workers/video-worker.ts` không bị lỗi `Cannot find package 'tsx'` trong môi trường production (`NODE_ENV=production`).

```json
{
  "name": "tikvoice",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "worker": "node --import tsx workers/video-worker.ts",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "mongoose": "^8.8.0",
    "bullmq": "^5.25.0",
    "ioredis": "^5.4.0",
    "fluent-ffmpeg": "^2.1.3",
    "@google/genai": "^0.1.1",
    "@google-cloud/text-to-speech": "^5.5.0",
    "nanoid": "^5.0.8",
    "formidable": "^3.5.2",
    "archiver": "^7.0.1",
    "zustand": "^5.0.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.4",
    "lucide-react": "^0.460.0",
    "sonner": "^1.7.0",
    "tsx": "^4.19.2"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "@types/node": "^22.9.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/fluent-ffmpeg": "^2.1.27",
    "@types/formidable": "^3.4.5",
    "@types/archiver": "^6.0.3",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "postcss": "^8.4.49"
  }
}
```

### 1.3 `next.config.ts`
```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'mongoose',
    'bullmq',
    'ioredis',
    'fluent-ffmpeg',
    'archiver',
  ],
};

export default nextConfig;
```

### 1.4 Cấu Trúc Thư Mục Chuẩn
```text
tikvoice/
├── docker-compose.yml          # App + Worker + Redis + MongoDB
├── Dockerfile                  # Base node:22-bookworm-slim + ffmpeg + python3/edge-tts + fonts
├── .env.example
├── next.config.ts              # serverExternalPackages
├── package.json
├── tsconfig.json
├── public/
│   ├── fonts/
│   │   └── BeVietnamPro-Bold.ttf # Font tiếng Việt chuẩn có dấu
│   └── music/                  # Nhạc nền royalty-free mẫu
├── storage/                    # Bind-mount volume lưu trữ tệp (gitignored)
│   ├── uploads/                # Video upload gốc
│   ├── audio/                  # Audio TTS tạo ra
│   ├── subtitles/              # File phụ đề .ass
│   ├── music/                  # Nhạc nền tải lên
│   └── exports/                # Video render hoàn tất
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx            # Dashboard danh sách video & stats
│   │   ├── batch/page.tsx      # Batch processing workspace
│   │   ├── projects/[id]/page.tsx # Main Video Editor Workspace
│   │   └── api/
│   │       ├── files/[...path]/route.ts # HTTP 206 Partial Content Streamer
│   │       ├── projects/route.ts
│   │       ├── projects/[id]/
│   │       │   ├── route.ts    # GET, PATCH, DELETE (xóa kèm file vật lý)
│   │       │   ├── script/route.ts
│   │       │   ├── tts/route.ts
│   │       │   ├── subtitle/route.ts
│   │       │   ├── render/route.ts
│   │       │   └── export/route.ts
│   │       ├── upload/route.ts
│   │       ├── tts/voices/route.ts
│   │       ├── tts/preview/route.ts
│   │       ├── batch/
│   │       │   ├── route.ts
│   │       │   └── [id]/
│   │       │       ├── route.ts        # Tiến độ lô batch
│   │       │       └── export/route.ts # Zip export stream bằng archiver
│   │       └── jobs/[id]/route.ts
│   ├── components/
│   │   ├── ui/                 # shadcn components
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   └── Header.tsx
│   │   ├── dashboard/
│   │   │   ├── ProjectCard.tsx
│   │   │   └── StatsOverview.tsx
│   │   ├── editor/
│   │   │   ├── VideoPlayer.tsx # Canvas / Video tag + Subtitle HTML/CSS Overlay (karaoke)
│   │   │   ├── Timeline.tsx
│   │   │   ├── ScriptEditor.tsx
│   │   │   ├── TTSPanel.tsx
│   │   │   ├── SubtitleStyler.tsx
│   │   │   ├── BackgroundMusicPanel.tsx
│   │   │   └── ExportPanel.tsx
│   │   └── batch/
│   │       ├── BatchUploader.tsx
│   │       └── BatchProgress.tsx
│   ├── lib/
│   │   ├── db/
│   │   │   ├── index.ts        # Mongoose connection cache
│   │   │   └── models/
│   │   │       ├── Project.ts  # Project model & embedded schemas
│   │   │       ├── Job.ts      # BullMQ Job tracking model
│   │   │       └── BatchGroup.ts # Batch processing group model
│   │   ├── queue/
│   │   │   ├── connection.ts   # Redis config
│   │   │   └── queues.ts       # BullMQ definitions
│   │   ├── tts/
│   │   │   ├── engine.ts
│   │   │   ├── edge-tts.ts
│   │   │   ├── google-tts.ts
│   │   │   └── voices.ts
│   │   ├── ai/
│   │   │   ├── gemini.ts       # @google/genai client
│   │   │   └── prompts.ts      # 5 kịch bản TikTok Affiliate mẫu
│   │   ├── video/
│   │   │   ├── ffmpeg.ts
│   │   │   ├── subtitle.ts     # ASS generator + hexToAssColor + fix đảo màu karaoke
│   │   │   └── merge.ts        # Dynamic FFmpeg filter_complex (fix map 1:a & loop bgm)
│   │   └── storage/local.ts    # File management & delete utility
│   ├── stores/
│   │   ├── editorStore.ts
│   │   └── batchStore.ts
│   └── types/
└── workers/
    └── video-worker.ts         # Tiến trình độc lập xử lý BullMQ jobs
```

---

## 2. DATABASE SCHEMA (MongoDB & Mongoose Models)

Tận dụng tối đa điểm mạnh của MongoDB (Document Database) bằng cách nhóm các trường liên quan thành **Embedded Objects (Subdocuments)**, giúp đọc/ghi toàn bộ thông tin project chỉ với 1 query duy nhất.

### 2.1 Mongoose Connection Cache (`src/lib/db/index.ts`)
```typescript
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tikvoice';

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseCache: MongooseCache | undefined;
}

let cached: MongooseCache = global.mongooseCache || { conn: null, promise: null };

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

export async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      maxPoolSize: 10,
    }).then((m) => m);
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}
```

### 2.2 Project Model với Word Timestamps (`src/lib/db/models/Project.ts`)
```typescript
import mongoose, { Schema, Document } from 'mongoose';
import { nanoid } from 'nanoid';

export interface IWordTimestamp {
  word: string;
  start: number; // millisecond
  end: number;   // millisecond
}

export interface ISubtitleStyle {
  fontFamily: string;
  fontSize: number;          // Mặc định: 64 (cho độ phân giải 1080p dọc)
  fontWeight: 'normal' | 'bold' | 'black';
  primaryColor: string;      // #FFFFFF (Màu chữ ban đầu)
  outlineColor: string;      // #000000 (Viền đen chống chìm)
  outlineWidth: number;      // 4
  shadowColor: string;
  shadowDepth: number;
  position: 'top' | 'center' | 'bottom';
  marginBottom: number;      // 120 (pixel)
  alignment: 'left' | 'center' | 'right';
  highlightEnabled: boolean; // Karaoke Highlight
  highlightColor: string;    // #FFD700 (Vàng gold khi đọc tới)
  animation: 'none' | 'fade' | 'typewriter' | 'bounce';
  maxCharsPerLine: number;   // 25
  wordsPerGroup: number;     // 3
}

export interface IProject extends Document {
  _id: string; // nanoid(12)
  name: string;
  description?: string;
  status: 'draft' | 'scripted' | 'voiced' | 'subtitled' | 'rendering' | 'done' | 'error';
  
  video?: {
    path: string;
    fileName: string;
    duration: number;
    width: number;
    height: number;
    fileSize: number;
  };

  script?: {
    text: string;
    templateId?: string;
    productName?: string;
    productInfo?: string;
  };

  tts: {
    engine: 'edge' | 'google';
    voice: string;
    speed: number;
    pitch: number;
    audioPath?: string;
    audioDuration?: number;
  };

  subtitle: {
    enabled: boolean;
    path?: string;
    style: ISubtitleStyle;
    // Bổ sung mảng words để Frontend VideoPlayer render overlay trực tiếp
    words: IWordTimestamp[];
  };

  bgMusic?: {
    path: string;
    name: string;
    volume: number;          // 0.12
    fadeIn: number;          // 2s
    fadeOut: number;         // 3s
  };

  export?: {
    path: string;
    resolution: string;      // 1080x1920
    quality: 'fast' | 'balanced' | 'high';
    fileSize?: number;
  };

  createdAt: Date;
  updatedAt: Date;
}

const SubtitleStyleSchema = new Schema<ISubtitleStyle>({
  fontFamily: { type: String, default: 'Be Vietnam Pro' },
  fontSize: { type: Number, default: 64 }, // Chuẩn 64px trên PlayRes 1080x1920
  fontWeight: { type: String, enum: ['normal', 'bold', 'black'], default: 'bold' },
  primaryColor: { type: String, default: '#FFFFFF' },
  outlineColor: { type: String, default: '#000000' },
  outlineWidth: { type: Number, default: 4 },
  shadowColor: { type: String, default: '#00000080' },
  shadowDepth: { type: Number, default: 2 },
  position: { type: String, enum: ['top', 'center', 'bottom'], default: 'bottom' },
  marginBottom: { type: Number, default: 120 },
  alignment: { type: String, enum: ['left', 'center', 'right'], default: 'center' },
  highlightEnabled: { type: Boolean, default: true },
  highlightColor: { type: String, default: '#FFD700' },
  animation: { type: String, enum: ['none', 'fade', 'typewriter', 'bounce'], default: 'none' },
  maxCharsPerLine: { type: Number, default: 25 },
  wordsPerGroup: { type: Number, default: 3 },
}, { _id: false });

const ProjectSchema = new Schema<IProject>({
  _id: { type: String, default: () => nanoid(12) },
  name: { type: String, required: true },
  description: String,
  status: {
    type: String,
    enum: ['draft', 'scripted', 'voiced', 'subtitled', 'rendering', 'done', 'error'],
    default: 'draft',
    index: true,
  },
  video: {
    path: String,
    fileName: String,
    duration: Number,
    width: Number,
    height: Number,
    fileSize: Number,
  },
  script: {
    text: String,
    templateId: String,
    productName: String,
    productInfo: String,
  },
  tts: {
    engine: { type: String, enum: ['edge', 'google'], default: 'edge' },
    voice: { type: String, default: 'vi-VN-HoaiMyNeural' },
    speed: { type: Number, default: 1.0 },
    pitch: { type: Number, default: 0 },
    audioPath: String,
    audioDuration: Number,
  },
  subtitle: {
    enabled: { type: Boolean, default: true },
    path: String,
    style: { type: SubtitleStyleSchema, default: () => ({}) },
    words: [{
      word: { type: String, required: true },
      start: { type: Number, required: true },
      end: { type: Number, required: true },
      _id: false,
    }],
  },
  bgMusic: {
    path: String,
    name: String,
    volume: { type: Number, default: 0.12 },
    fadeIn: { type: Number, default: 2 },
    fadeOut: { type: Number, default: 3 },
  },
  export: {
    path: String,
    resolution: { type: String, default: '1080x1920' },
    quality: { type: String, enum: ['fast', 'balanced', 'high'], default: 'balanced' },
    fileSize: Number,
  },
}, { timestamps: true });

export const Project = mongoose.models.Project || mongoose.model<IProject>('Project', ProjectSchema);
```

### 2.3 Models Cho Jobs & Batch (`Job.ts`, `BatchGroup.ts`)
```typescript
// src/lib/db/models/Job.ts
import mongoose, { Schema } from 'mongoose';
import { nanoid } from 'nanoid';

const JobSchema = new Schema({
  _id: { type: String, default: () => nanoid(12) },
  projectId: { type: String, ref: 'Project', required: true, index: true },
  bullmqJobId: String,
  type: { type: String, enum: ['tts', 'subtitle', 'render', 'full_pipeline'], required: true },
  status: { type: String, enum: ['queued', 'processing', 'done', 'error'], default: 'queued', index: true },
  progress: { type: Number, default: 0 },
  error: String,
  result: Schema.Types.Mixed,
  completedAt: Date,
}, { timestamps: true });

export const Job = mongoose.models.Job || mongoose.model('Job', JobSchema);

// src/lib/db/models/BatchGroup.ts
import mongoose, { Schema } from 'mongoose';
import { nanoid } from 'nanoid';

const BatchGroupSchema = new Schema({
  _id: { type: String, default: () => nanoid(12) },
  name: String,
  status: { type: String, enum: ['pending', 'processing', 'done', 'error'], default: 'pending' },
  items: [{
    projectId: { type: String, ref: 'Project' },
    order: Number,
    status: { type: String, enum: ['pending', 'processing', 'done', 'error'], default: 'pending' },
    error: String,
  }],
  sharedConfig: Schema.Types.Mixed,
  completedAt: Date,
}, { timestamps: true });

export const BatchGroup = mongoose.models.BatchGroup || mongoose.model('BatchGroup', BatchGroupSchema);
```

---

## 3. CORE PROCESSING LOGIC & ENGINES

### 3.1 Text-to-Speech Engine
- Hỗ trợ giao diện `TTSEngine` chuẩn:
  ```typescript
  interface TTSEngine {
    synthesize(text: string, options: TTSOptions): Promise<TTSResult>;
    listVoices(): Promise<Voice[]>;
  }
  ```
- **Edge TTS**: Dùng giọng `vi-VN-HoaiMyNeural` (Nữ Bắc) và `vi-VN-NamMinhNeural` (Nam Bắc). Phải trích xuất được **word-level timestamps** (thời điểm bắt đầu và kết thúc của từng từ bằng milliseconds) từ SubMaker/WordBoundary để phục vụ làm phụ đề karaoke.
- **Google Cloud TTS**: Hỗ trợ SSML ngắt câu tự nhiên và giọng WaveNet/Neural2 chất lượng cao.

### 3.2 AI Script Generator & 5 Mẫu Kịch Bản TikTok Affiliate (`src/lib/ai/prompts.ts`)
```typescript
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const SCRIPT_TEMPLATES = {
  quick_review: {
    id: 'quick_review',
    name: 'Review nhanh 30s',
    description: 'Kịch bản review ngắn gọn, hook mạnh, CTA rõ ràng',
    estimatedDuration: 30,
    maxWords: 120,
    promptTemplate: `Bạn là một TikToker chuyên review sản phẩm với giọng điệu tự nhiên, gần gũi, có chút hài hước.
Viết kịch bản lồng tiếng cho video TikTok review sản phẩm dài khoảng 30 giây.

Cấu trúc bắt buộc:
1. Hook (2-3 giây, 1-2 câu): Mở đầu gây tò mò, shock nhẹ hoặc đặt câu hỏi. Ví dụ: "Mình đã thử cái này suốt 1 tháng và kết quả khiến mình không tin nổi..."
2. Vấn đề (3-5 giây, 1-2 câu): Nêu vấn đề mà người xem đang gặp phải, tạo đồng cảm.
3. Giải pháp + Ưu điểm (15-18 giây, 3-5 câu): Giới thiệu sản phẩm, highlight 2-3 ưu điểm nổi bật nhất. Dùng cụm từ mạnh: "game changer", "phải thử ngay", "hơn hẳn".
4. CTA (3-5 giây, 1-2 câu): Kêu gọi hành động rõ ràng. Ví dụ: "Link sản phẩm ở bio nha!", "Comment 'muốn' để mình gửi link!"

Sản phẩm: {productName}
Thông tin sản phẩm: {productInfo}
Yêu cầu thêm: {customInstructions}

Quy tắc viết:
- Giọng văn tự nhiên như đang nói chuyện, KHÔNG giống đọc quảng cáo.
- Dùng ngôn ngữ đời thường, có thể xen tiếng lóng Gen Z phù hợp.
- KHÔNG quá 120 từ (tương đương ~30 giây đọc).
- KHÔNG dùng emoji trong kịch bản (để Text-to-Speech không đọc lỗi).
- KHÔNG ghi chú đạo diễn (không viết "(cười)", "(nhấn mạnh)").
- Viết liền mạch, mỗi đoạn cách nhau bằng 1 dòng trống.
Chỉ trả về kịch bản, không giải thích thêm.`,
  },

  unboxing: {
    id: 'unboxing',
    name: 'Mở hộp / Unboxing',
    description: 'Kịch bản mở hộp sản phẩm, tạo sự háo hức',
    estimatedDuration: 45,
    maxWords: 180,
    promptTemplate: `Bạn là một TikToker chuyên làm video unboxing/mở hộp sản phẩm.
Viết kịch bản lồng tiếng cho video unboxing dài khoảng 45 giây.

Cấu trúc:
1. Teaser (3s): Tạo sự tò mò về sản phẩm sắp mở.
2. Mở hộp (10s): Mô tả ấn tượng đầu tiên, packaging, phụ kiện kèm theo.
3. First Impression (15s): Cảm nhận ban đầu khi cầm/dùng thử, so sánh với kỳ vọng.
4. Đánh giá nhanh (10s): 2-3 điểm nổi bật nhất.
5. CTA (5s): Kêu gọi follow để xem review chi tiết.

Sản phẩm: {productName}
Thông tin: {productInfo}
Yêu cầu thêm: {customInstructions}

Quy tắc: Tự nhiên, háo hức, không quá 180 từ, không emoji, không ghi chú đạo diễn.
Chỉ trả về kịch bản.`,
  },

  comparison: {
    id: 'comparison',
    name: 'So sánh 2 sản phẩm',
    description: 'Kịch bản so sánh 2 sản phẩm cạnh tranh',
    estimatedDuration: 45,
    maxWords: 180,
    promptTemplate: `Bạn là reviewer so sánh sản phẩm trên TikTok.
Viết kịch bản so sánh dài ~45 giây.

Cấu trúc:
1. Hook (3s): Đặt câu hỏi so sánh gây tranh cãi.
2. Giới thiệu 2 SP (5s): Tên, giá cả.
3. So sánh từng tiêu chí (25s): 3-4 tiêu chí, mỗi tiêu chí nêu rõ winner.
4. Verdict (7s): Kết luận nên mua cái nào.
5. CTA (5s): Link mua ở bio/giỏ hàng.

Sản phẩm: {productName}
Thông tin: {productInfo}
Yêu cầu thêm: {customInstructions}

Quy tắc: Công bằng nhưng có winner rõ ràng, không quá 180 từ, không emoji.
Chỉ trả về kịch bản.`,
  },

  top_list: {
    id: 'top_list',
    name: 'Top 3-5 lý do nên mua',
    description: 'Kịch bản liệt kê lý do mua sản phẩm',
    estimatedDuration: 40,
    maxWords: 160,
    promptTemplate: `Bạn là TikToker review sản phẩm.
Viết kịch bản "Top lý do nên mua" dài ~40 giây.

Cấu trúc:
1. Hook (3s): "X lý do bạn PHẢI mua [sản phẩm] ngay!"
2. Lý do 1-3/5 (mỗi lý do 7-8s): Ngắn gọn, đánh trúng tâm lý.
3. Bonus tip (5s): Mẹo sử dụng hoặc deal giảm giá đang có.
4. CTA (5s): Kêu gọi chốt đơn.

Sản phẩm: {productName}
Thông tin: {productInfo}
Yêu cầu thêm: {customInstructions}

Quy tắc: Năng lượng cao, đếm ngược dứt khoát, không quá 160 từ, không emoji.
Chỉ trả về kịch bản.`,
  },

  storytelling: {
    id: 'storytelling',
    name: 'Kể chuyện trải nghiệm',
    description: 'Kịch bản kể chuyện cá nhân sử dụng sản phẩm',
    estimatedDuration: 45,
    maxWords: 180,
    promptTemplate: `Bạn là một người dùng thực tế kể lại trải nghiệm với sản phẩm.
Viết kịch bản kể chuyện dài ~45 giây.

Cấu trúc:
1. Mở đầu (5s): Bối cảnh — "Mình từng gặp vấn đề X..."
2. Khó khăn (8s): Mô tả nỗi đau cụ thể khiến bạn khó chịu.
3. Phát hiện SP (5s): "Cho đến khi mình tìm thấy em này..."
4. Trải nghiệm (15s): Kể chi tiết quá trình dùng, thay đổi thế nào.
5. Kết (7s): Cảm nhận tổng thể và lời khuyên chân thành.
6. CTA (5s): Giục người xem xem link ở góc trái.

Sản phẩm: {productName}
Thông tin: {productInfo}
Yêu cầu thêm: {customInstructions}

Quy tắc: Chân thực, có cảm xúc, không quá 180 từ, không emoji.
Chỉ trả về kịch bản.`,
  },
};

export async function generateProductScript(params: {
  productName: string;
  productInfo: string;
  templateId: string;
  customInstructions?: string;
}): Promise<string> {
  const template = SCRIPT_TEMPLATES[params.templateId as keyof typeof SCRIPT_TEMPLATES] || SCRIPT_TEMPLATES.quick_review;
  const prompt = template.promptTemplate
    .replace('{productName}', params.productName)
    .replace('{productInfo}', params.productInfo || 'Không có')
    .replace('{customInstructions}', params.customInstructions || 'Không có');

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
  });

  return response.text?.trim() || '';
}
```

### 3.3 Subtitle Engine Chuẩn ASS 1080p (`src/lib/video/subtitle.ts`)
> **Fix Bug Đảo Màu Karaoke**: Thẻ `{\kf}` trong ASS hiển thị chữ ban đầu bằng `SecondaryColour` (màu trắng) và khi giọng đọc chạy qua mới quét sang `PrimaryColour` (màu highlight vàng gold).

```typescript
import { IWordTimestamp, ISubtitleStyle } from '@/lib/db/models/Project';

/**
 * Đổi mã màu HEX #RRGGBB sang định dạng ASS BGR: &H00BBGGRR
 */
export function hexToAssColor(hex: string): string {
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length !== 6) return '&H00FFFFFF';
  const r = cleanHex.slice(0, 2);
  const g = cleanHex.slice(2, 4);
  const b = cleanHex.slice(4, 6);
  return `&H00${b}${g}${r}`.toUpperCase();
}

/**
 * Tạo nội dung file .ass với Karaoke Highlight chuẩn
 */
export function generateAssFile(
  words: IWordTimestamp[],
  style: ISubtitleStyle
): string {
  const primaryColor = hexToAssColor(style.primaryColor);     // Ví dụ: Trắng
  const highlightColor = hexToAssColor(style.highlightColor); // Ví dụ: Vàng kim
  const outlineColor = hexToAssColor(style.outlineColor);     // Đen

  // FIX LỖI ĐẢO MÀU:
  // Khi bật Karaoke Highlight: PrimaryColour phải là màu Highlight, SecondaryColour là màu chữ ban đầu
  const assPrimary = style.highlightEnabled ? highlightColor : primaryColor;
  const assSecondary = style.highlightEnabled ? primaryColor : highlightColor;

  const alignment = style.position === 'top' ? 8 : style.position === 'center' ? 5 : 2;

  let ass = `[Script Info]
Title: TikVoice Subtitles
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${style.fontFamily},${style.fontSize},${assPrimary},${assSecondary},${outlineColor},&H80000000,${style.fontWeight === 'bold' || style.fontWeight === 'black' ? 1 : 0},0,0,0,100,100,0,0,1,${style.outlineWidth},${style.shadowDepth},${alignment},40,40,${style.marginBottom},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  // Gom từ thành từng nhóm (mỗi nhóm khoảng wordsPerGroup từ)
  const groups: IWordTimestamp[][] = [];
  let current: IWordTimestamp[] = [];

  for (const w of words) {
    current.push(w);
    if (current.length >= (style.wordsPerGroup || 3)) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length > 0) groups.push(current);

  for (const group of groups) {
    const startMs = group[0].start;
    const endMs = group[group.length - 1].end;
    const startTime = msToAssTime(startMs);
    const endTime = msToAssTime(endMs);

    if (style.highlightEnabled) {
      let lineText = '';
      for (const w of group) {
        // centiseconds = Math.round(durationMs / 10)
        const durationCs = Math.max(1, Math.round((w.end - w.start) / 10));
        lineText += `{\\kf${durationCs}}${w.word} `;
      }
      ass += `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${lineText.trim()}\n`;
    } else {
      const lineText = group.map((w) => w.word).join(' ');
      ass += `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${lineText}\n`;
    }
  }

  return ass;
}

function msToAssTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}
```

### 3.4 FFmpeg Pipeline Không Crash (`src/lib/video/merge.ts`)
> **Fix Bug Mapping 1:a**: Khi map trực tiếp từ input stream, không được bọc dấu ngoặc vuông (`-map 1:a` thay vì `-map [1:a]`).
> **Fix Nhạc Nền Bị Tắt Giữa Chừng**: Thêm `-stream_loop -1` cho input nhạc nền nếu nhạc nền ngắn hơn audio giọng đọc.

```typescript
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';

export interface DynamicRenderConfig {
  videoPath: string;
  videoDuration: number;
  audioPath: string;
  audioDuration: number;
  subtitlePath?: string;
  subtitleEnabled: boolean;
  bgMusicPath?: string;
  bgMusicVolume?: number;
  bgMusicFadeIn?: number;
  bgMusicFadeOut?: number;
  outputPath: string;
  quality: 'fast' | 'balanced' | 'high';
  onProgress?: (percent: number) => void;
}

export function executeRenderPipeline(config: DynamicRenderConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    let command = ffmpeg();

    // 1. Loop video gốc nếu ngắn hơn giọng đọc TTS
    if (config.videoDuration < config.audioDuration) {
      command = command.input(config.videoPath).inputOptions(['-stream_loop', '-1']);
    } else {
      command = command.input(config.videoPath);
    }

    // Input 1: Audio giọng đọc TTS
    command = command.input(config.audioPath);

    const filterParts: string[] = [];
    let currentVideoLabel = 'v0';
    let audioMapOption = '1:a'; // Mặc định map trực tiếp từ input 1 (KHÔNG có ngoặc vuông)

    // Scale & Pad video về chuẩn 1080x1920 (TikTok 9:16)
    filterParts.push(
      `[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black[${currentVideoLabel}]`
    );

    // Xử lý nhạc nền
    const hasBgMusic = config.bgMusicPath && fs.existsSync(config.bgMusicPath);
    if (hasBgMusic) {
      // Loop nhạc nền vô hạn để không bị ngắt quãng giữa chừng
      command = command.input(config.bgMusicPath!).inputOptions(['-stream_loop', '-1']);
      
      const volume = config.bgMusicVolume ?? 0.12;
      const fadeIn = config.bgMusicFadeIn ?? 2;
      const fadeOut = config.bgMusicFadeOut ?? 3;
      const fadeOutStart = Math.max(0, config.audioDuration - fadeOut);

      filterParts.push(
        `[2:a]volume=${volume},afade=t=in:st=0:d=${fadeIn},afade=t=out:st=${fadeOutStart}:d=${fadeOut}[bgm]`,
        `[1:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[a0]`
      );
      audioMapOption = '[a0]'; // Khi có filter amix thì map qua nhãn [a0]
    } else {
      audioMapOption = '1:a'; // Không có nhạc nền: map thẳng stream 1:a
    }

    // Xử lý phụ đề ASS kèm fontsdir để tránh lỗi font trên Linux
    const hasSubtitle = config.subtitleEnabled && config.subtitlePath && fs.existsSync(config.subtitlePath);
    if (hasSubtitle) {
      const normalizedPath = config.subtitlePath!.replace(/\\/g, '/').replace(/:/g, '\\:');
      const fontsDir = path.resolve('public/fonts').replace(/\\/g, '/').replace(/:/g, '\\:');
      
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

    command
      .complexFilter(filterParts)
      .outputOptions([
        `-map [${currentVideoLabel}]`,
        `-map ${audioMapOption}`, // Đúng cú pháp: [a0] hoặc 1:a
        `-c:v libx264`,
        `-preset ${preset}`,
        `-crf ${crf}`,
        `-c:a aac`,
        `-b:a 192k`,
        `-t ${config.audioDuration}`, // Video cắt chính xác bằng thời lượng giọng đọc
        `-movflags +faststart`,
        `-y`,
      ])
      .output(config.outputPath)
      .on('progress', (p) => {
        if (config.onProgress && p.percent) {
          config.onProgress(Math.min(100, Math.round(p.percent)));
        }
      })
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}
```

---

## 4. MEDIA STREAMING & API SPECIFICATIONS

### 4.1 Media Streaming Route với HTTP 206 Range (`src/app/api/files/[...path]/route.ts`)
Cho phép trình duyệt tua (seek) video và audio mượt mà từ `/storage`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;
  const relativePath = pathSegments.join('/');
  const fullPath = path.resolve(process.env.STORAGE_PATH || './storage', relativePath);

  // Ngăn chặn Path Traversal
  if (!fullPath.startsWith(path.resolve(process.env.STORAGE_PATH || './storage'))) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  if (!fs.existsSync(fullPath)) {
    return new NextResponse('File Not Found', { status: 404 });
  }

  const stat = fs.statSync(fullPath);
  const fileSize = stat.size;
  const range = request.headers.get('range');
  const contentType = getContentType(fullPath);

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize) {
      return new NextResponse('Requested range not satisfiable', {
        status: 416,
        headers: { 'Content-Range': `bytes */${fileSize}` },
      });
    }

    const chunksize = end - start + 1;
    const fileStream = fs.createReadStream(fullPath, { start, end });

    return new NextResponse(fileStream as any, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize.toString(),
        'Content-Type': contentType,
      },
    });
  } else {
    const fileStream = fs.createReadStream(fullPath);
    return new NextResponse(fileStream as any, {
      status: 200,
      headers: {
        'Content-Length': fileSize.toString(),
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
      },
    });
  }
}

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.mp4': return 'video/mp4';
    case '.mov': return 'video/quicktime';
    case '.webm': return 'video/webm';
    case '.mp3': return 'audio/mpeg';
    case '.wav': return 'audio/wav';
    case '.ass': return 'text/plain; charset=utf-8';
    default: return 'application/octet-stream';
  }
}
```

### 4.2 Xóa Project Kèm Dọn Dẹp File Vật Lý (`DELETE /api/projects/[id]`)
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Project } from '@/lib/db/models/Project';
import fs from 'fs/promises';
import path from 'path';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();
  const { id } = await params;

  const project = await Project.findById(id);
  if (!project) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

  // Xóa các file vật lý liên quan
  const storageDir = process.env.STORAGE_PATH || './storage';
  const dirsToClean = [
    path.join(storageDir, 'uploads', id),
    path.join(storageDir, 'audio', id),
    path.join(storageDir, 'subtitles', id),
    path.join(storageDir, 'music', id),
    path.join(storageDir, 'exports', id),
  ];

  for (const dir of dirsToClean) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (e) {
      // Bỏ qua lỗi file không tồn tại
    }
  }

  await Project.findByIdAndDelete(id);
  return NextResponse.json({ success: true, message: 'Deleted successfully' });
}
```

### 4.3 Batch Progress & Zip Export (`src/app/api/batch/[id]/export/route.ts`)
Sử dụng `archiver` để gom các video đã render thành file `.zip` stream về:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { BatchGroup } from '@/lib/db/models/BatchGroup';
import { Project } from '@/lib/db/models/Project';
import archiver from 'archiver';
import { PassThrough } from 'stream';
import fs from 'fs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();
  const { id } = await params;

  const batch = await BatchGroup.findById(id);
  if (!batch) return new NextResponse('Batch not found', { status: 404 });

  const projectIds = batch.items.map((i: any) => i.projectId);
  const projects = await Project.find({ _id: { $in: projectIds }, status: 'done' });

  const archive = archiver('zip', { zlib: { level: 6 } });
  const stream = new PassThrough();

  archive.pipe(stream);

  for (const p of projects) {
    if (p.export?.path && fs.existsSync(p.export.path)) {
      const fileName = `${p.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${p._id}.mp4`;
      archive.file(p.export.path, { name: fileName });
    }
  }

  archive.finalize();

  return new NextResponse(stream as any, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="tikvoice-batch-${id}.zip"`,
    },
  });
}
```

---

## 5. GIAO DIỆN NGƯỜI DÙNG (FRONTEND WORKSPACE & WIREFRAMES)

### 5.1 Dashboard (`/`)
```text
┌──────────────────────────────────────────────────────────────────┐
│  🎬 TikVoice                                    [+ Tạo mới]    │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📊 Thống kê: 12 videos | 5 hôm nay | 3 đang xử lý            │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ 🎬          │  │ 🎬          │  │ 🎬          │             │
│  │ thumbnail   │  │ thumbnail   │  │ thumbnail   │             │
│  │             │  │             │  │             │             │
│  │ Son MAC     │  │ iPhone 16   │  │ Kem chống   │             │
│  │ Review      │  │ Unboxing    │  │ nắng review │             │
│  │ ✅ Done     │  │ ⏳ Rendering│  │ 📝 Draft    │             │
│  │ 30s | 2.1MB │  │ 45s         │  │             │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐                               │
│  │ 📦 Batch    │  │ + Tạo mới   │                               │
│  │ 10 videos   │  │             │                               │
│  │ 7/10 done   │  │  [Drag &    │                               │
│  │ ████████░░  │  │   Drop]     │                               │
│  └─────────────┘  └─────────────┘                               │
└──────────────────────────────────────────────────────────────────┘
```

### 5.2 Studio Editor (`/projects/[id]`) — ★ Trọng Tâm
Bố cục 3 khu vực chính:
1. **Khung Video Preview (Trọng tâm)**:
   - Trình phát video tỷ lệ dọc 9:16 (TikTok).
   - Render subtitle giả lập theo thời gian thực: Dùng mảng `subtitle.words` để chạy hiệu ứng Karaoke Highlight trực tiếp trên HTML/CSS overlay đồng bộ với `currentTime` của thẻ `<video>` mà không cần đợi render FFmpeg.
2. **Thanh Sidebar Công Cụ (5 Tabs)**:
   - Tab 📝 **Kịch bản**: Editor soạn thảo văn bản + Nút "AI Viết Script" (dropdown chọn 5 mẫu kịch bản, ô nhập tên sản phẩm, thông tin bổ sung).
   - Tab 🗣️ **Giọng đọc**: Chọn Engine (Edge free / Google premium), chọn Giọng (Hoài My / Nam Minh), thanh trượt tốc độ (0.75x - 1.5x) và cao độ, nút "Nghe thử câu mẫu" và nút "Tạo giọng nói đầy đủ".
   - Tab 💬 **Phụ đề**: Tùy chỉnh Font chữ, Cỡ chữ (mặc định 64), Màu chính, Màu viền, Màu Karaoke Highlight, Vị trí (Top / Center / Bottom).
   - Tab 🎵 **Nhạc nền**: Upload MP3 nhạc nền hoặc chọn mẫu sẵn, thanh trượt Volume (10% - 15%), Fade in/out.
   - Tab 🚀 **Xuất video**: Chọn chất lượng xuất (Fast / Balanced / High), nút "Render Video" (kèm thanh tiến trình % cập nhật theo thời gian thực từ BullMQ Job).
3. **Thanh Timeline Dưới Cùng**:
   - Hiển thị rãnh Video và rãnh Audio Waveform để người dùng nắm bắt độ dài tương ứng.

```text
┌──────────────────────────────────────────────────────────────────┐
│  ← Back   "Son MAC Ruby Woo Review"     📝 Draft    [🚀 Export]│
├────────┬─────────────────────────────────────────────────────────┤
│        │                                                         │
│ 📝     │  ┌─────────────────────────────────────────────────┐   │
│ Script │  │                                                 │   │
│        │  │              VIDEO PREVIEW                      │   │
│ 🗣️     │  │                                                 │   │
│ Voice  │  │         ┌─────────────────┐                     │   │
│        │  │         │  Subtitle here  │                     │   │
│ 📝     │  │         └─────────────────┘                     │   │
│ Sub    │  │  ▶️ play/pause    00:15 / 00:30                 │   │
│        │  └─────────────────────────────────────────────────┘   │
│ 🎵     │                                                         │
│ Music  │  ┌─────────────────────────────────────────────────┐   │
│        │  │ Timeline: [====video====][===audio===]          │   │
│ ⚙️     │  │           [===subtitle===]  [==bgmusic==]       │   │
│ Export │  └─────────────────────────────────────────────────┘   │
│        │                                                         │
│        │  ┌─ Active Panel ──────────────────────────────────┐   │
│        │  │                                                 │   │
│        │  │  [Tab Kịch bản / Giọng đọc / Phụ đề / Nhạc]    │   │
│        │  │                                                 │   │
│        │  └─────────────────────────────────────────────────┘   │
├────────┴─────────────────────────────────────────────────────────┤
│  ████████████████████░░░░░░░░  Rendering: 68%  ETA: 45s         │
└──────────────────────────────────────────────────────────────────┘
```

### 5.3 Batch Processing Workspace (`/batch`)
- Khu vực Drag & Drop nhiều file video cùng lúc.
- Bảng danh sách: Mỗi hàng gồm Tên file video, Ô nhập tên sản phẩm / Script, Trạng thái.
- Bộ cấu hình chung cho cả lô: Chọn chung 1 giọng đọc, 1 style phụ đề, 1 bản nhạc nền.
- Nút "Bắt đầu xử lý hàng loạt" -> BullMQ xử lý tuần tự từng video để tránh quá tải CPU -> Nút tải trọn bộ file `.zip`.

---

## 6. DOCKER & DEPLOYMENT CONFIGURATION

### 6.1 `docker-compose.yml`
```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    volumes:
      - ./storage:/app/storage
    depends_on:
      redis:
        condition: service_healthy
      mongo:
        condition: service_healthy
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/tikvoice
      - REDIS_URL=redis://redis:6379
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - GOOGLE_APPLICATION_CREDENTIALS=${GOOGLE_APPLICATION_CREDENTIALS:-}
      - STORAGE_PATH=/app/storage
    restart: unless-stopped

  worker:
    build:
      context: .
      dockerfile: Dockerfile
    command: node --import tsx workers/video-worker.ts
    volumes:
      - ./storage:/app/storage
    depends_on:
      redis:
        condition: service_healthy
      mongo:
        condition: service_healthy
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/tikvoice
      - REDIS_URL=redis://redis:6379
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - GOOGLE_APPLICATION_CREDENTIALS=${GOOGLE_APPLICATION_CREDENTIALS:-}
      - STORAGE_PATH=/app/storage
    restart: unless-stopped

  mongo:
    image: mongo:7.0
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    restart: unless-stopped

volumes:
  mongo_data:
  redis_data:
```

### 6.2 `Dockerfile`
```dockerfile
FROM node:22-bookworm-slim AS base

# 1. Cài đặt các gói hệ thống bắt buộc
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-pip \
    python3-venv \
    fontconfig \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 2. Tạo virtualenv và cài đặt edge-tts CLI để trích xuất WordBoundary ổn định
ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"
RUN pip install --no-cache-dir edge-tts

WORKDIR /app

# 3. Copy và cài đặt font chữ hệ thống
COPY public/fonts/BeVietnamPro-Bold.ttf /usr/share/fonts/truetype/
RUN fc-cache -f -v

# 4. Cài đặt npm dependencies (bao gồm tsx trong dependencies)
COPY package.json package-lock.json ./
RUN npm ci

# 5. Copy toàn bộ mã nguồn và build Next.js
COPY . .
RUN npm run build

# 6. Tạo thư mục storage
RUN mkdir -p storage/uploads storage/audio storage/subtitles storage/music storage/exports

EXPOSE 3000
CMD ["npm", "start"]
```

### 6.3 `.env.example`
```env
NODE_ENV=production
PORT=3000

MONGODB_URI=mongodb://mongo:27017/tikvoice
REDIS_URL=redis://redis:6379

# Google Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here

# Google Cloud TTS (Optional)
GOOGLE_APPLICATION_CREDENTIALS=

STORAGE_PATH=/app/storage
MAX_CONCURRENT_RENDERS=1
```

---

## 7. KẾ HOẠCH TRIỂN KHAI THEO TỪNG MILESTONE

Xây dựng dự án tuần tự theo 6 bước:

- **Bước 1**: Khởi tạo repo Next.js 15, cài đặt dependencies (`mongoose`, `bullmq`, `ioredis`, `fluent-ffmpeg`, `archiver`, `tsx`), cấu hình Mongoose connection cache và các Models (`Project`, `Job`, `BatchGroup`).
- **Bước 2**: Xây dựng module TTS (`edge-tts` & `google-cloud-tts`), API upload video và API sinh file audio MP3 kèm word timestamps lưu vào MongoDB.
- **Bước 3**: Xây dựng module FFmpeg merge audio + video, render final video và hoàn thiện BullMQ Video Worker cập nhật trạng thái vào MongoDB (đã fix map 1:a và loop nhạc nền).
- **Bước 4**: Xây dựng module Subtitle generator định dạng ASS, tích hợp karaoke word highlight (đã fix đảo màu) và burn vào video.
- **Bước 5**: Tích hợp Gemini API sinh script tự động theo 5 template chuyên dụng cho TikTok Affiliate.
- **Bước 6**: Hoàn thiện toàn bộ UI Studio Editor, bổ sung tab Nhạc nền, trang Batch processing, HTTP 206 Streaming route, Zip Export và test deploy qua Docker Compose.

---

## 8. QUY TẮC BẢO VỆ CODE & XỬ LÝ LỖI PRODUCTION
1. **FFmpeg Map Safety**: Tuyệt đối không bọc ngoặc vuông khi map stream trực tiếp từ input (`-map 1:a`), chỉ dùng ngoặc vuông cho filter output label (`-map [a0]`).
2. **Loop Media**: Luôn dùng `-stream_loop -1` cho video gốc và nhạc nền nếu thời lượng của chúng ngắn hơn audio giọng đọc TTS để tránh video/nhạc bị cắt đen hoặc câm giữa chừng.
3. **Karaoke Colors in ASS**: Thẻ `{\kf}` luôn tô từ `SecondaryColour` sang `PrimaryColour`. Khi bật highlight, `PrimaryColour` bắt buộc là màu Highlight và `SecondaryColour` là màu chữ gốc.
4. **Next.js 15 Handling**: Luôn luôn `const { id } = await params;` trong tất cả dynamic route handlers và server components.
5. **Database Connection**: Luôn gọi `await connectDB();` trước bất kỳ thao tác nào với Mongoose trong API Route hoặc Worker.
6. **Path Traversal Prevention**: Trong route `/api/files/[...path]`, luôn kiểm tra `fullPath.startsWith(storageDir)` trước khi đọc file để tránh lỗ hổng bảo mật.
7. **Concurrency Limit**: Concurrency của Worker Render video chỉ đặt tối đa là `1` (hoặc `2` nếu VPS >= 4 vCPU) để tránh quá tải CPU/RAM khi mã hóa H.264.
```
