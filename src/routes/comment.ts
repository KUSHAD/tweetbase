import { Hono } from 'hono';
import {
  createComment,
  deleteComment,
  getCommentsByTweetId,
  updateComment,
} from '../controller/comment';
import { authMiddleware } from '../middleware/auth';

const commentRouter = new Hono();

commentRouter
  .all('/', authMiddleware)
  .post(createComment)
  .patch(updateComment)
  .delete(deleteComment);
commentRouter.get('/tweet', getCommentsByTweetId);

export type AppType = typeof commentRouter;
export default commentRouter;
