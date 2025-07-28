import { Hono } from 'hono';
import {
  deleteTweet,
  editTweet,
  getTweet,
  getUserTweets,
  newTweet,
  quoteTweet,
  retweet,
} from '../../controller/tweet';
import { authMiddleware } from '../../middleware/auth';

const tweetRouter = new Hono();

tweetRouter.post('/', authMiddleware, newTweet);
tweetRouter
  .all('/:tweetId')
  .get(getTweet)
  .patch(authMiddleware, editTweet)
  .delete(authMiddleware, deleteTweet);
tweetRouter.post('/retweet/:tweetId', authMiddleware, retweet);
tweetRouter.post('/quote/:tweetId', authMiddleware, quoteTweet);
tweetRouter.get('/user/:userId', getUserTweets);

export default tweetRouter;
