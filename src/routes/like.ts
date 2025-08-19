import { Hono } from 'hono';
import { getLikes, likeTweet, unlikeTweet } from '../controller/like';
import { authMiddleware } from '../middleware/auth';

const likeRouter = new Hono();

likeRouter.all('/', authMiddleware).post(likeTweet).get(getLikes).delete(unlikeTweet);

export default likeRouter;
