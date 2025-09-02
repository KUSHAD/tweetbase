import { Hono } from 'hono';
import {
  createComment,
  deleteComment,
  getCommentsByTweetId,
  updateComment,
} from '../controller/comment';
import { authMiddleware } from '../middleware/auth';
import { subscriptionMiddleware } from '../middleware/subscription';

const commentRouter = new Hono()
  .all(authMiddleware)
  .post('/', createComment)
  .patch('/', subscriptionMiddleware, updateComment)
  .delete('/', deleteComment)
  .get('/tweet', getCommentsByTweetId);

export type AppType = typeof commentRouter;
export default commentRouter;
