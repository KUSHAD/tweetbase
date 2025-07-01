import { Hono } from 'hono';
import {
  searchProfiles,
  updateAccountType,
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
profileRouter.patch('/account', authMiddleware, updateAccountType);

export default profileRouter;
