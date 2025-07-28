import { Hono } from 'hono';
import standaloneRouter from './standalone';

const router = new Hono();

router.route('/standalone', standaloneRouter);

export default router;
