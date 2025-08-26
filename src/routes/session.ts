import { Hono } from 'hono';
import { getActiveSessions, me, revokeSession, rotateRefreshToken } from '../controller/session';
import { authMiddleware } from '../middleware/auth';

const sessionRouter = new Hono()
  .get('/me', authMiddleware, me)
  .post('/refresh', rotateRefreshToken)
  .get('/active', authMiddleware, getActiveSessions)
  .delete('/revoke', authMiddleware, revokeSession);

export type AppType = typeof sessionRouter;
export default sessionRouter;
