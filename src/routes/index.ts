import { Hono } from 'hono';
import authRouter from './auth';
import bookmarkRouter from './bookmark';
import commentRouter from './comment';
import docsRouter from './docs';
import feedRouter from './feed';
import likeRouter from './like';
import networkRouter from './network';
import notificationsRouter from './notifications';
import profileRouter from './profile';
import pusherRouter from './pusher';
import sessionRouter from './session';
import { subscriptionRouter } from './subscription';
import tweetRouter from './tweet';
import webhookRouter from './webhook';

const router = new Hono()
  .route('/auth', authRouter)
  .route('/session', sessionRouter)
  .route('/subscription', subscriptionRouter)
  .route('/profile', profileRouter)
  .route('/network', networkRouter)
  .route('/tweet', tweetRouter)
  .route('/like', likeRouter)
  .route('/comment', commentRouter)
  .route('/feed', feedRouter)
  .route('/bookmark', bookmarkRouter)
  .route('/notification', notificationsRouter)
  .route('/docs', docsRouter)
  .route('/webhook', webhookRouter)
  .route('/pusher', pusherRouter);

export type AppType = typeof router;
export default router;
