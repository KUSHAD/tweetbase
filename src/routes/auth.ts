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

const authRouter = new Hono()
  .post('/signup', signup)
  .post('/login', login)
  .post('/logout', authMiddleware, logout)
  .post('/email-verification', authMiddleware, verifyEmail)
  .post('/forgot-password', sendPasswordResetEmail)
  .post('/reset-password', resetPasswordMiddleware, resetPassword);

export type AppType = typeof authRouter;
export default authRouter;
