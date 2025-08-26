// src/routes/docs.ts
import { Scalar } from '@scalar/hono-api-reference';
import { Hono } from 'hono';

const docsRouter = new Hono().get(
  '/',
  Scalar({
    url: '/openapi.json',
    theme: 'deepSpace',
    layout: 'modern',
    defaultHttpClient: { targetKey: 'js', clientKey: 'axios' },
    favicon: '/logo.png',
    hideDarkModeToggle: true,
    darkMode: true,
    forceDarkModeState: 'dark',
    pageTitle: 'Tweetbase Docs',
  }),
);

export type AppType = typeof docsRouter;
export default docsRouter;
