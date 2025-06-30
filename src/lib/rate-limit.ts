import { RedisStore } from '@hono-rate-limiter/redis';
import { rateLimiter } from 'hono-rate-limiter';
import { redis } from './redis';

export const limiter = rateLimiter({
  keyGenerator: (c) =>
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-forwarded-for') ||
    c.req.raw.headers.get('host') ||
    'unknown',
  windowMs: 60000, // 1 minute
  limit: 20,
  store: new RedisStore({ client: redis }),
});
