import { Hono } from 'hono';
import {
  login,
  logout,
  resetPassword,
  sendPasswordResetEmail,
  signup,
  verifyEmail,
} from '../controller/auth';
import { authMiddleware } from '../middleware/auth';
import { resetPasswordMiddleware } from '../middleware/reset-password';

const authRouter = new Hono();

authRouter.post('/signup', signup);
authRouter.post('/login', login);
authRouter.post('/logout', authMiddleware, logout);
authRouter.post('/email-verification', authMiddleware, verifyEmail);
authRouter.post('/forgot-password', sendPasswordResetEmail);
authRouter.post('/reset-password', resetPasswordMiddleware, resetPassword);

export default authRouter;
