import { Hono } from 'hono';
import { exploreFeed, myFeed } from '../controller/feed';
import { authMiddleware } from '../middleware/auth';

const feedRouter = new Hono()
  .get('/', authMiddleware, myFeed)
  .get('/explore', authMiddleware, exploreFeed);

export type AppType = typeof feedRouter;
export default feedRouter;
