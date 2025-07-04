import { Hono } from 'hono';
import authRouter from './auth';
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

export default router;
