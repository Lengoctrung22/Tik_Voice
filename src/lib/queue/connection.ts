import { Redis } from 'ioredis';
import type { ConnectionOptions } from 'bullmq';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

function parseRedisFields() {
  try {
    if (REDIS_URL.startsWith('redis://') || REDIS_URL.startsWith('rediss://')) {
      const parsed = new URL(REDIS_URL);
      return {
        host: parsed.hostname || 'localhost',
        port: parseInt(parsed.port || '6379', 10),
        password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
        username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      };
    }
  } catch {
    // fallback if URL parsing fails
  }

  return {
    host: 'localhost',
    port: 6379,
    password: undefined,
    username: undefined,
  };
}

export function createRedisClient(): Redis {
  return new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export function createFastFailRedisClient(timeoutMs = 1500): Redis {
  const client = new Redis(REDIS_URL, {
    lazyConnect: true,
    connectTimeout: timeoutMs,
    enableOfflineQueue: false,
    enableReadyCheck: false,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });
  client.on('error', () => {});
  return client;
}

export async function ensureRedisAvailable(timeoutMs = 1500): Promise<void> {
  const client = createFastFailRedisClient(timeoutMs);
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      (async () => {
        await client.connect();
        await client.ping();
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('Hết thời gian kết nối hàng đợi xử lý nền (Redis)'));
        }, timeoutMs);
      }),
    ]);
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : 'Kết nối thất bại';
    throw new Error(
      `Hàng đợi xử lý nền (Redis) chưa sẵn sàng (${detail}). Hãy khởi động Redis và Worker rồi thử lại.`
    );
  } finally {
    if (timer) clearTimeout(timer);
    client.disconnect();
  }
}

export function getRedisConnectionOptions(): ConnectionOptions {
  const { host, port, password, username } = parseRedisFields();
  return {
    host,
    port,
    password,
    username,
    maxRetriesPerRequest: null,
  };
}

export function getRedisQueueConnectionOptions(): ConnectionOptions {
  const { host, port, password, username } = parseRedisFields();
  return {
    host,
    port,
    password,
    username,
    connectTimeout: 2000,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy: (times: number) => (times > 1 ? null : 200),
  };
}
