import { Hono } from 'hono';
import { createBookmark, getBookmarks, removeBookmark } from '../controller/bookmark';
import { authMiddleware } from '../middleware/auth';

const bookmarkRouter = new Hono();

bookmarkRouter
  .all('/', authMiddleware)
  .post(createBookmark)
  .delete(removeBookmark)
  .get(getBookmarks);

export default bookmarkRouter;
