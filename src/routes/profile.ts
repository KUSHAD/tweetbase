import { Hono } from 'hono';
import { updateBasicInfo, updateUsername } from '../controller/profile';
import { authMiddleware } from '../middleware/auth';

const profileRouter = new Hono();

profileRouter.patch('/basic-info', authMiddleware, updateBasicInfo);
profileRouter.patch('/username', authMiddleware, updateUsername);

export default profileRouter;
