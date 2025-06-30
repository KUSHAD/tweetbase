import 'dotenv/config';

import { createId } from '@paralleldrive/cuid2';
import { Hono } from 'hono';
import { cache } from 'hono/cache';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { requestId } from 'hono/request-id';

import { limiter } from './lib/rate-limit';
import router from './routes';

const app = new Hono<{ Bindings: CloudflareBindings }>();

// 🌐 Enable CORS globally
app.use('*', cors());

// 🚫 Global rate limiter (Upstash Redis-backed)
app.use('*', limiter);

// 🆔 Attach a request ID to every request
app.use(
  '*',
  requestId({
    generator: () => createId(),
  }),
);

// 📜 Log each request (includes request ID)
app.use('*', logger());

// 🧠 Optionally cache GET responses
app.get(
  '*',
  cache({
    cacheName: 'service',
    cacheControl: 'max-age=10',
    cacheableStatusCodes: [200, 404, 412],
  }),
);

// 🛣️ Mount all application routes
app.route('/', router);

export default app;
