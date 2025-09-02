import { Hono } from 'hono';
import { createBookmark, getBookmarks, removeBookmark } from '../controller/bookmark';
import { authMiddleware } from '../middleware/auth';
import { subscriptionMiddleware } from '../middleware/subscription';

const bookmarkRouter = new Hono()
  .all(authMiddleware)
  .post('/', subscriptionMiddleware, createBookmark)
  .delete('/', removeBookmark)
  .get('/', getBookmarks);

export type AppType = typeof bookmarkRouter;
export default bookmarkRouter;
