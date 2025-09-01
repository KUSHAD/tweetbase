import { Hono } from 'hono';
import { pusherAuth } from '../controller/pusher';
import { authMiddleware } from '../middleware/auth';

const pusherRouter = new Hono().post('/auth', authMiddleware, pusherAuth);

export type AppType = typeof pusherRouter;
export default pusherRouter;
