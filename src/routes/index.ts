import { Hono } from 'hono';
import authRouter from './auth';
import sessionRouter from './session';

const router = new Hono();

router.route('/auth', authRouter);
router.route('/session', sessionRouter);

export default router;
