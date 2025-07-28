import { Hono } from 'hono';
import {
  followUser,
  getFollowers,
  getFollowing,
  getSuggestedFollows,
  unfollowUser,
} from '../../controller/network';
import { authMiddleware } from '../../middleware/auth';

const networkRouter = new Hono();

networkRouter.post('/follow', authMiddleware, followUser);
networkRouter.delete('/unfollow', authMiddleware, unfollowUser);
networkRouter.get('/followers', authMiddleware, getFollowers);
networkRouter.get('/following', authMiddleware, getFollowing);
networkRouter.get('/suggested', authMiddleware, getSuggestedFollows);

export default networkRouter;
