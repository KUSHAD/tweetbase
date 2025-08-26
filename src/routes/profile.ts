import { Hono } from 'hono';
import {
  getProfile,
  searchProfiles,
  updateAvatar,
  updateBasicInfo,
  updateUsername,
} from '../controller/profile';
import { authMiddleware } from '../middleware/auth';

const profileRouter = new Hono()
  .patch('/basic-info', authMiddleware, updateBasicInfo)
  .patch('/username', authMiddleware, updateUsername)
  .get('/search', authMiddleware, searchProfiles)
  .patch('/avatar', authMiddleware, updateAvatar)
  .get('/', getProfile);

export type AppType = typeof profileRouter;
export default profileRouter;
