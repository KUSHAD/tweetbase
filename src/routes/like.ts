import { Hono } from 'hono';
import { getLikes, likeTweet, unlikeTweet } from '../controller/like';
import { authMiddleware } from '../middleware/auth';

const likeRouter = new Hono()
  .all(authMiddleware)
  .post('/', likeTweet)
  .get('/', getLikes)
  .delete('/', unlikeTweet);

export type AppType = typeof likeRouter;
export default likeRouter;
