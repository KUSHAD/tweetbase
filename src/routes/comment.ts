import { Hono } from 'hono';
import {
  createComment,
  deleteComment,
  getCommentsByTweetId,
  updateComment,
} from '../controller/comment';
import { authMiddleware } from '../middleware/auth';

const commentRouter = new Hono()
  .all(authMiddleware)
  .post('/', createComment)
  .patch('/', updateComment)
  .delete('/', deleteComment)
  .get('/tweet', getCommentsByTweetId);

export type AppType = typeof commentRouter;
export default commentRouter;
