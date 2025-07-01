import { Hono } from 'hono';
import { followUser, unfollowUser } from '../controller/network';
import { authMiddleware } from '../middleware/auth';

const networkRouter = new Hono();

networkRouter.post('/follow', authMiddleware, followUser);
networkRouter.delete('/unfollow', authMiddleware, unfollowUser);

export default networkRouter;
