import { neon } from '@neondatabase/serverless';
import { upstashCache } from 'drizzle-orm/cache/upstash';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle({
  client: sql,
  schema,
  cache: upstashCache({
    url: process.env.REDIS_URL,
    token: process.env.REDIS_TOKEN,
    global: true,
    config: {
      keepTtl: true,
      ex: 10,
      px: 10000,
    },
  }),
  logger: true,
});
