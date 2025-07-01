import { Hono } from 'hono';
import { searchProfiles, updateBasicInfo, updateUsername } from '../controller/profile';
import { authMiddleware } from '../middleware/auth';

const profileRouter = new Hono();

profileRouter.patch('/basic-info', authMiddleware, updateBasicInfo);
profileRouter.patch('/username', authMiddleware, updateUsername);
profileRouter.get('/search', authMiddleware, searchProfiles);

export default profileRouter;
