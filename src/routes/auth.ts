import { Hono } from 'hono';
import { login, logout, me, rotateRefreshToken, signup } from '../controller/auth';
import { authMiddleware } from '../middleware/auth';

const authRouter = new Hono();

authRouter.post('/signup', signup);
authRouter.post('/login', login);
authRouter.post('/logout', authMiddleware, logout);
authRouter.post('/refresh', rotateRefreshToken);
authRouter.get('/me', authMiddleware, me);

export default authRouter;
