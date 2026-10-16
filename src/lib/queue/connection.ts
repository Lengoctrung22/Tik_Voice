import { ConnectionOptions } from 'bullmq';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export function getRedisConnectionOptions(): ConnectionOptions {
  try {
    if (REDIS_URL.startsWith('redis://') || REDIS_URL.startsWith('rediss://')) {
      const parsed = new URL(REDIS_URL);
      return {
        host: parsed.hostname || 'localhost',
        port: parseInt(parsed.port || '6379', 10),
        password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
        username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
        maxRetriesPerRequest: null,
      };
    }
  } catch {
    // fallback if URL parsing fails
  }

  return {
    host: 'localhost',
    port: 6379,
    maxRetriesPerRequest: null,
  };
}
