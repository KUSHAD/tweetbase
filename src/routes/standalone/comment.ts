import { Hono } from 'hono';
import {
  createComment,
  deleteComment,
  getCommentsByTweetId,
  updateComment,
} from '../../controller/comment';
import { authMiddleware } from '../../middleware/auth';

const commentRouter = new Hono();

commentRouter.post('/', authMiddleware, createComment);
commentRouter.all('/:commentId', authMiddleware).patch(updateComment).delete(deleteComment);
commentRouter.get('/tweet/:tweetId', getCommentsByTweetId);

export default commentRouter;
