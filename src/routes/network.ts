import { Hono } from 'hono';
import {
  followUser,
  getFollowers,
  getFollowing,
  getSuggestedFollows,
  unfollowUser,
} from '../controller/network';
import { authMiddleware } from '../middleware/auth';
import { subscriptionMiddleware } from '../middleware/subscription';

const networkRouter = new Hono()
  .post('/follow', authMiddleware, followUser)
  .delete('/unfollow', authMiddleware, unfollowUser)
  .get('/followers', authMiddleware, getFollowers)
  .get('/following', authMiddleware, getFollowing)
  .get('/suggested', authMiddleware, subscriptionMiddleware, getSuggestedFollows);

export type AppType = typeof networkRouter;
export default networkRouter;
