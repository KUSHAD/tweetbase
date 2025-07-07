import { Hono } from 'hono';
import { getTweet, newTweet } from '../controller/tweet';
import { authMiddleware } from '../middleware/auth';

const tweetRouter = new Hono();

tweetRouter.post('/', authMiddleware, newTweet);
tweetRouter.get('/:tweetId', authMiddleware, getTweet);

export default tweetRouter;
