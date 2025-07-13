import { Hono } from 'hono';
import {
  deleteTweet,
  editTweet,
  getTweet,
  newTweet,
  quoteTweet,
  retweet,
} from '../controller/tweet';
import { authMiddleware } from '../middleware/auth';

const tweetRouter = new Hono();

tweetRouter.post('/', authMiddleware, newTweet);
tweetRouter.all('/:tweetId', authMiddleware).get(getTweet).patch(editTweet).delete(deleteTweet);
tweetRouter.post('/retweet/:tweetId', authMiddleware, retweet);
tweetRouter.post('/quote/:tweetId', authMiddleware, quoteTweet);

export default tweetRouter;
