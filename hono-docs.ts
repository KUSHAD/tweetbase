import { defineConfig } from '@rcmade/hono-docs';

export default defineConfig({
  tsConfigPath: './tsconfig.json',
  openApi: {
    openapi: '3.0.0',
    info: { title: 'Tweetbase', version: '1.0.0' },
    servers: [
      { url: 'http://localhost:3000' },
      { url: 'https://tweetbase.kushad-chakraborty.workers.dev' },
    ],
  },
  outputs: {
    openApiJson: './public/openapi.json',
  },
  apis: [
    {
      apiPrefix: '/auth',
      name: 'Auth',
      appTypePath: './src/routes/auth.ts',
    },
    {
      apiPrefix: '/session',
      name: 'Session',
      appTypePath: './src/routes/session.ts',
    },
    {
      apiPrefix: '/profile',
      name: 'Profile',
      appTypePath: './src/routes/profile.ts',
    },
    {
      apiPrefix: '/network',
      name: 'Network',
      appTypePath: './src/routes/network.ts',
    },
    {
      apiPrefix: '/tweets',
      name: 'Tweets',
      appTypePath: './src/routes/tweet.ts',
    },
    {
      apiPrefix: '/like',
      name: 'Likes',
      appTypePath: './src/routes/like.ts',
    },
    {
      apiPrefix: '/comment',
      name: 'Comments',
      appTypePath: './src/routes/comment.ts',
    },
    {
      apiPrefix: '/feed',
      name: 'Feed',
      appTypePath: './src/routes/feed.ts',
    },
    {
      apiPrefix: '/bookmark',
      name: 'Bookmarks',
      appTypePath: './src/routes/bookmark.ts',
    },
    {
      apiPrefix: '/notification',
      name: 'Notifications',
      appTypePath: './src/routes/notifications.ts',
    },
    {
      apiPrefix: '/pusher',
      name: 'Pusher',
      appTypePath: './src/routes/pusher.ts',
    },
  ],
});
