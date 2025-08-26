import { defineConfig } from '@rcmade/hono-docs';

export default defineConfig({
  tsConfigPath: './tsconfig.json',
  openApi: {
    openapi: '3.0.0',
    info: { title: 'Tweetbase', version: '1.0.0' },
    servers: [
      { url: 'http://localhost:3000' },
      { url: 'tweetbase.kushad-chakraborty.workers.dev' },
    ],
  },
  outputs: {
    openApiJson: './src/openapi.json',
  },
  apis: [],
});
