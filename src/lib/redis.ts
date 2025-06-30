import { Redis } from '@upstash/redis/cloudflare';

export const redis = new Redis({
  url: process.env.REDIS_URL,
  token: process.env.REDIS_TOKEN,
});
