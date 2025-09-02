import { Hono } from 'hono';
import {
  deleteTweet,
  editTweet,
  getTweet,
  getUserTweets,
  newTweet,
  quoteTweet,
  retweet,
} from '../controller/tweet';
import { authMiddleware } from '../middleware/auth';
import { subscriptionMiddleware } from '../middleware/subscription';

const tweetRouter = new Hono()
  .post('/', authMiddleware, newTweet)
  .get('/', getTweet)
  .patch('/', authMiddleware, subscriptionMiddleware, editTweet)
  .delete('/', authMiddleware, deleteTweet)
  .post('/retweet', authMiddleware, subscriptionMiddleware, retweet)
  .post('/quote', authMiddleware, subscriptionMiddleware, quoteTweet)
  .get('/user', getUserTweets);

export type AppType = typeof tweetRouter;
export default tweetRouter;
