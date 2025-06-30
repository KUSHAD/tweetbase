import { Hono } from 'hono';
import authRouter from './auth';
import profileRouter from './profile';
import sessionRouter from './session';

const router = new Hono();

router.route('/auth', authRouter);
router.route('/session', sessionRouter);
router.route('/profile', profileRouter);

export default router;
