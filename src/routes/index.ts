import { Hono } from 'hono';
import authRouter from './auth';
import bookmarkRouter from './bookmark';
import commentRouter from './comment';
import feedRouter from './feed';
import likeRouter from './like';
import networkRouter from './network';
import profileRouter from './profile';
import sessionRouter from './session';
import tweetRouter from './tweet';

const router = new Hono();

router.route('/auth', authRouter);
router.route('/session', sessionRouter);
router.route('/profile', profileRouter);
router.route('/network', networkRouter);
router.route('/tweet', tweetRouter);
router.route('/like', likeRouter);
router.route('/comment', commentRouter);
router.route('/feed', feedRouter);
router.route('/bookmark', bookmarkRouter);

export default router;
