import 'dotenv/config';

import { createId } from '@paralleldrive/cuid2';
import { Hono } from 'hono';
import { cache } from 'hono/cache';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { requestId } from 'hono/request-id';
import router from './routes';

const app = new Hono();

app.use('*', cors());
app.use(
  '*',
  requestId({
    generator: () => createId(),
  }),
);
app.use(logger());
app.get(
  '*',
  cache({
    cacheName: 'service',
    cacheControl: 'max-age=3600',
    cacheableStatusCodes: [200, 404, 412],
  }),
);
app.route('/', router);

export default app;
