import { Hono } from 'hono';
import {
  getProfile,
  searchProfiles,
  updateAvatar,
  updateBasicInfo,
  updateUsername,
} from '../controller/profile';
import { authMiddleware } from '../middleware/auth';

const profileRouter = new Hono();

profileRouter.patch('/basic-info', authMiddleware, updateBasicInfo);
profileRouter.patch('/username', authMiddleware, updateUsername);
profileRouter.get('/search', authMiddleware, searchProfiles);
profileRouter.patch('/avatar', authMiddleware, updateAvatar);
profileRouter.get('/', getProfile);

export default profileRouter;
