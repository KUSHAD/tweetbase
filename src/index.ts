import 'dotenv/config';

import { createId } from '@paralleldrive/cuid2';
import { Hono } from 'hono';
import { cache } from 'hono/cache';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { requestId } from 'hono/request-id';

import { HTTPException } from 'hono/http-exception';
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

app.notFound((c) =>
  c.json(
    { error: 'Not Found', method: c.req.method, path: c.req.path, requestId: c.get('requestId') },
    404,
  ),
);

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    // Get the custom response
    return c.json(
      {
        error: err.name,
        message: err.getResponse(),
        stack: err.stack,
        cause: err.cause,
        requestId: c.get('requestId'),
      },
      err.status,
    );
  }
  return c.json(
    {
      error: err.name,
      message: err.message,
      stack: err.stack,
      cause: err.cause,
      requestId: c.get('requestId'),
    },
    500,
  );
});

export default app;
