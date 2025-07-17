import { Hono } from 'hono';
import authRouter from './auth';
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

export default router;
