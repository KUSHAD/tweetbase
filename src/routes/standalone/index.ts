import { Hono } from 'hono';
import authRouter from './auth';
import commentRouter from './comment';
import likeRouter from './like';
import networkRouter from './network';
import profileRouter from './profile';
import sessionRouter from './session';
import tweetRouter from './tweet';

const standaloneRouter = new Hono();

standaloneRouter.route('/auth', authRouter);
standaloneRouter.route('/session', sessionRouter);
standaloneRouter.route('/profile', profileRouter);
standaloneRouter.route('/network', networkRouter);
standaloneRouter.route('/tweet', tweetRouter);
standaloneRouter.route('/like', likeRouter);
standaloneRouter.route('/comment', commentRouter);

export default standaloneRouter;
