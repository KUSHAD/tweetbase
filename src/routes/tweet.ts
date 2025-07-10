import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { deleteTweet, editTweet, getTweet, newTweet, retweet } from '../controller/tweet';
import { authMiddleware } from '../middleware/auth';
import { getTweetSchema } from '../validators/tweet';

const tweetRouter = new Hono();

tweetRouter.post('/', authMiddleware, newTweet);
tweetRouter
  .all('/:tweetId', authMiddleware)
  .get(getTweet)
  .patch(zValidator('param', getTweetSchema), editTweet)
  .delete(deleteTweet);
tweetRouter.post('/retweet/:tweetId', authMiddleware, retweet);

export default tweetRouter;
