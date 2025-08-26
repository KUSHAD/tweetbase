import { Hono } from 'hono';
import { pusherAuth } from '../controller/pusher';

const pusherRouter = new Hono().post('/auth', pusherAuth);

export type AppType = typeof pusherRouter;
export default pusherRouter;
