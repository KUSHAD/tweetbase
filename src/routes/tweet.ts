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

const tweetRouter = new Hono();

tweetRouter
  .all('/')
  .post(authMiddleware, newTweet)
  .get(getTweet)
  .patch(authMiddleware, editTweet)
  .delete(authMiddleware, deleteTweet);
tweetRouter.post('/retweet', authMiddleware, retweet);
tweetRouter.post('/quote', authMiddleware, quoteTweet);
tweetRouter.get('/user', getUserTweets);

export default tweetRouter;
