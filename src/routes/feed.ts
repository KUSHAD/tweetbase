import { Hono } from 'hono';
import { exploreFeed, myFeed } from '../controller/feed';
import { authMiddleware } from '../middleware/auth';

const feedRouter = new Hono();

feedRouter.get('/', authMiddleware, myFeed);
feedRouter.get('/explore', authMiddleware, exploreFeed);

export type AppType = typeof feedRouter;
export default feedRouter;
