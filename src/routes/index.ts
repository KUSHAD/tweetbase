import { Hono } from 'hono';
import authRouter from './auth';
import networkRouter from './network';
import profileRouter from './profile';
import sessionRouter from './session';

const router = new Hono();

router.route('/auth', authRouter);
router.route('/session', sessionRouter);
router.route('/profile', profileRouter);
router.route('/network', networkRouter);

export default router;
