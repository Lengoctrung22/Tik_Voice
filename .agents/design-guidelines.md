# 🎨 TikVoice — Design Guidelines

> Nguồn gốc: Dựa trên [anthropics/skills/frontend-design](https://github.com/anthropics/skills/tree/main/skills/frontend-design), điều chỉnh cho TikVoice — AI Video Voice-Over Studio.

---

## Bản sắc thiết kế

TikVoice là **công cụ sản xuất video chuyên nghiệp** cho TikTok Affiliate Marketing. Đối tượng sử dụng là content creators Việt Nam — người cần tốc độ xử lý, giao diện rõ ràng, không rườm rà.

Giao diện phải truyền tải: **công cụ chuyên nghiệp nhưng thân thiện, nhanh gọn, đáng tin cậy**. Không phải landing page marketing. Không phải SaaS dashboard generic. Đây là studio biên tập — mọi phần tử phải phục vụ workflow.

---

## Design Token System

### Color Palette

```
--tv-bg-primary:     #09090B     /* Zinc-950 — nền chính, tối để video preview nổi bật */
--tv-bg-secondary:   #18181B     /* Zinc-900 — panels, sidebar */
--tv-bg-elevated:    #27272A     /* Zinc-800 — cards, hover states */
--tv-border:         #3F3F46     /* Zinc-700 — viền nhẹ phân tách vùng */

--tv-text-primary:   #FAFAFA     /* Zinc-50 — chữ chính */
--tv-text-secondary: #A1A1AA     /* Zinc-400 — chữ phụ, labels */
--tv-text-muted:     #71717A     /* Zinc-500 — metadata, timestamps */

--tv-accent:         #F97316     /* Orange-500 — accent chính, TikTok-inspired */
--tv-accent-hover:   #EA580C     /* Orange-600 — hover state */
--tv-accent-subtle:  #431407     /* Orange-950 — accent background nhẹ */

--tv-success:        #22C55E     /* Green-500 — trạng thái Done, hoàn tất */
--tv-warning:        #EAB308     /* Yellow-500 — đang xử lý, rendering */
--tv-error:          #EF4444     /* Red-500 — lỗi, thất bại */

--tv-karaoke:        #FFD700     /* Gold — highlight karaoke mặc định */
```

Lý do: Nền tối giúp video preview 9:16 trở thành focal point tự nhiên. Orange accent lấy cảm hứng từ hệ sinh thái TikTok mà không copy trực tiếp.

### Typography

**Font family duy nhất: Be Vietnam Pro** — đã được chọn vì hỗ trợ dấu tiếng Việt hoàn chỉnh và sẵn có trong hệ thống (cài sẵn trong Docker image).

```
--tv-font-family:    'Be Vietnam Pro', system-ui, sans-serif

/* Type Scale (rem, base 16px) */
--tv-text-xs:        0.75rem    /* 12px — metadata, timestamps */
--tv-text-sm:        0.875rem   /* 14px — labels, captions */
--tv-text-base:      1rem       /* 16px — body text */
--tv-text-lg:        1.125rem   /* 18px — panel titles */
--tv-text-xl:        1.25rem    /* 20px — page headings */
--tv-text-2xl:       1.5rem     /* 24px — dashboard project names */

/* Font Weights */
--tv-font-normal:    400
--tv-font-medium:    500        /* Labels, nav items */
--tv-font-semibold:  600        /* Panel headings, buttons */
--tv-font-bold:      700        /* Page titles, stats */
```

Quy tắc:
- **Không** dùng font thứ 2. Be Vietnam Pro đủ đa dạng weight cho mọi vai trò.
- Line-height body: 1.6. Line-height heading: 1.2.
- Max line-length cho text content: 72 ký tự (phù hợp tiếng Việt có dấu).

### Spacing & Layout

```
--tv-space-1:   4px
--tv-space-2:   8px
--tv-space-3:   12px
--tv-space-4:   16px
--tv-space-5:   20px
--tv-space-6:   24px
--tv-space-8:   32px
--tv-space-10:  40px
--tv-space-12:  48px

--tv-radius-sm:   6px      /* Buttons, inputs */
--tv-radius-md:   8px      /* Cards, panels */
--tv-radius-lg:   12px     /* Modals, popovers */
--tv-radius-full: 9999px   /* Badges, pills */
```

### Border-radius

Không áp dụng cùng một border-radius cho mọi thứ. Phân biệt rõ:
- Buttons, inputs: `radius-sm` (6px)
- Cards, panels: `radius-md` (8px)
- Video preview container: `radius-md` (8px) với overflow hidden
- Badges trạng thái: `radius-full` (pill)

---

## Nguyên tắc thiết kế

### 1. Video Preview là trung tâm

Trong Editor (`/projects/[id]`), video preview 9:16 là thứ quan trọng nhất. Mọi thứ khác — sidebar, panels, timeline — đều phục vụ nó. Video preview chiếm diện tích lớn nhất, nền xung quanh tối để tạo contrast tự nhiên.

### 2. Panels phục vụ workflow, không trang trí

5 tab sidebar (Script, Voice, Subtitle, Music, Export) là các bước workflow tuần tự. Thiết kế panel phải:
- Hiển thị rõ tab nào đang active
- Cho thấy bước nào đã hoàn thành (checkmark nhỏ) vs chưa làm
- Không thêm border/shadow/decoration không cần thiết

### 3. Feedback states rõ ràng

TikVoice xử lý nhiều tác vụ nặng (TTS generation, FFmpeg rendering). Feedback phải:
- Progress bar với % cụ thể, không dùng spinner vô hạn cho task dài
- Trạng thái rendering hiện ETA ước tính
- Toast notifications (Sonner) cho hành động nhanh (save, delete)
- Inline error messages cho form validation

### 4. Motion có chủ đích

- **Có**: Transition mượt khi chuyển tab panel (150ms ease), progress bar animation, fade-in cho toast
- **Có**: Subtle hover state trên buttons và cards
- **Không**: Fade-and-slide-up khi load sections, parallax, bouncing animations
- **Không**: Staggered card entrance trên dashboard
- Tôn trọng `prefers-reduced-motion`: tắt toàn bộ animation nếu người dùng yêu cầu

### 5. Hierarchy rõ ràng qua spacing, không qua decoration

Phân tách các vùng bằng spacing và màu nền, không bằng borders dày hoặc shadows. Ví dụ:
- Sidebar: background `--tv-bg-secondary`, ngăn cách với content area bằng 1px border `--tv-border`
- Panel content: padding `--tv-space-6`
- Cards trên dashboard: background `--tv-bg-elevated`, không box-shadow

---

## Anti-patterns cần tránh

Các dấu hiệu "AI-generated" phổ biến — **không làm** trong TikVoice:

| ❌ Tránh | ✅ Thay bằng |
|----------|-------------|
| Background kem ấm (#F4F1EA) + serif font | Nền tối Zinc-950 + Be Vietnam Pro sans-serif |
| ALL-CAPS eyebrow labels trên mọi heading | Sentence case, chỉ uppercase cho badges trạng thái |
| Numbered markers (01 / 02 / 03) cho mọi thứ | Chỉ dùng số cho workflow steps thực sự tuần tự |
| Middle dots nối metadata (A · B · C) | Separator đơn giản: dấu `|` hoặc spacing |
| Cùng một rounded card + soft shadow cho tất cả | Border-radius phân biệt theo hierarchy |
| Gradient washes làm decoration | Gradient chỉ dùng cho progress bars hoặc accent rất có chủ đích |
| Mũi tên `→` sau mọi link/button text | Chỉ dùng `→` cho navigation links, không cho action buttons |
| Monospace font cho data labels | Be Vietnam Pro medium weight cho mọi label |
| Accent một từ trong heading bằng màu khác | Heading đồng màu, dùng weight để nhấn mạnh |

---

## Hướng dẫn viết UI copy (Tiếng Việt)

### Nguyên tắc chung
- Viết từ góc nhìn người dùng, không từ góc nhìn hệ thống
- Active voice. Nút bấm nói rõ hành động: "Tạo giọng đọc", không phải "Gửi"
- Sentence case cho labels và headings: "Chọn giọng đọc", không phải "CHỌN GIỌNG ĐỌC"
- Giữ nhất quán: nút "Render video" → toast "Video đã render xong" → trạng thái "Đã hoàn tất"

### Buttons & CTAs

| Loại | Ví dụ đúng | Ví dụ sai |
|------|-----------|-----------|
| Tạo mới | "Tạo dự án" | "Bắt đầu" / "Submit" |
| Xử lý | "Tạo giọng đọc" | "Xử lý TTS" |
| Xuất | "Render video" | "Bắt đầu xuất" |
| Hành động phụ | "Nghe thử" | "Preview Audio" |
| Xóa | "Xóa dự án" | "Xóa" (quá mơ hồ) |
| Hủy | "Hủy bỏ" | "Quay lại" (khác nghĩa) |

### Empty States

Màn hình trống là lời mời hành động, không phải nơi trống rỗng:

```
Dashboard trống:
  "Chưa có dự án nào"
  "Tải lên video đầu tiên để bắt đầu tạo nội dung"
  [+ Tạo dự án mới]

Batch trống:
  "Kéo thả video vào đây"
  "Hỗ trợ MP4, MOV, WebM — tối đa 20 video mỗi lô"
```

### Error Messages

Giải thích rõ lỗi gì + cách sửa. Không xin lỗi, không mơ hồ:

```
❌ Sai: "Đã xảy ra lỗi. Vui lòng thử lại."
✅ Đúng: "Không tạo được giọng đọc: file script trống. Viết hoặc tạo script trước."

❌ Sai: "Lỗi render video"
✅ Đúng: "Render thất bại: video gốc bị hỏng. Tải lên lại video khác."

❌ Sai: "Upload failed"
✅ Đúng: "File quá lớn (tối đa 500MB). Nén video trước khi tải lên."
```

### Trạng thái dự án

| Status | Hiển thị | Badge color |
|--------|---------|-------------|
| `draft` | Bản nháp | `--tv-text-muted` (grey) |
| `scripted` | Có script | `--tv-text-secondary` |
| `voiced` | Đã tạo giọng | Blue-500 |
| `subtitled` | Có phụ đề | Blue-500 |
| `rendering` | Đang render | `--tv-warning` (yellow, pulse) |
| `done` | Hoàn tất | `--tv-success` (green) |
| `error` | Lỗi | `--tv-error` (red) |

---

## Hướng dẫn theo component

### Dashboard (`/`)

- Grid layout: 3 cột desktop, 2 cột tablet, 1 cột mobile
- ProjectCard: thumbnail nhỏ (aspect 9:16) bên trái, thông tin bên phải
- Stats row ở trên: chỉ hiện 3 con số quan trọng (tổng, hôm nay, đang xử lý)
- Không dùng charts/graphs cho dashboard đơn giản — con số + icon đủ rồi

### Editor Workspace (`/projects/[id]`)

- Layout: sidebar cố định trái (48-56px icons) + content area
- Video preview: chiếm tối đa chiều cao có thể, căn giữa trong content area
- Timeline: cố định dưới cùng, chiều cao cố định 80-100px
- Active panel: bên dưới video preview hoặc bên phải tùy viewport
- Tab icons trong sidebar: dùng Lucide React, 20px, có tooltip

### Sidebar Navigation

- Icon-only ở mặc định, expand label khi hover/focus
- Active tab: accent background subtle + icon màu accent
- Completed tab: small checkmark indicator
- Disabled tab: opacity 0.4 (chưa đủ data để dùng)

### Batch Workspace (`/batch`)

- Drop zone: border dashed 2px, height 200px, centered text + icon
- Table list: compact rows, mỗi hàng có inline status badge
- Shared config sidebar: dạng form cố định bên phải
- Bulk progress: progress bar tổng + chi tiết từng video

---

## Quy trình khi thiết kế UI mới

1. **Xác định component thuộc vùng nào** (Dashboard / Editor / Batch)
2. **Áp dụng token system** — không hardcode colors, spacing, font-size
3. **Viết UI copy tiếng Việt** theo hướng dẫn trên
4. **Kiểm tra anti-patterns** — đối chiếu với bảng "Tránh" ở trên
5. **Responsive**: desktop-first nhưng phải hoạt động ở 768px
6. **Accessibility floor**: visible focus states, đủ contrast ratio (4.5:1), keyboard navigation cho mọi interactive element

---

## Tham khảo

- Nguồn gốc skill: [anthropics/skills/frontend-design](https://github.com/anthropics/skills/tree/main/skills/frontend-design)
- Font: [Be Vietnam Pro](https://fonts.google.com/specimen/Be+Vietnam+Pro)
- Icons: [Lucide React](https://lucide.dev/)
- Components: [shadcn/ui](https://ui.shadcn.com/) — customize theo token system, không dùng mặc định
- Toast: [Sonner](https://sonner.emilkowal.dev/)
