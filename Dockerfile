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
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# 5. Copy toàn bộ mã nguồn và build Next.js
COPY . .
RUN npm run build

# 6. Tạo thư mục storage
RUN mkdir -p storage/uploads storage/audio storage/subtitles storage/music storage/exports

EXPOSE 3000
CMD ["npm", "start"]
