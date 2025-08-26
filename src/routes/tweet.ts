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

const tweetRouter = new Hono()
  .post('/', authMiddleware, newTweet)
  .get('/', getTweet)
  .patch('/', authMiddleware, editTweet)
  .delete('/', authMiddleware, deleteTweet)
  .post('/retweet', authMiddleware, retweet)
  .post('/quote', authMiddleware, quoteTweet)
  .get('/user', getUserTweets);

export type AppType = typeof tweetRouter;
export default tweetRouter;
