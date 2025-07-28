import { Hono } from 'hono';
import { getActiveSessions, me, revokeSession, rotateRefreshToken } from '../../controller/session';
import { authMiddleware } from '../../middleware/auth';

const sessionRouter = new Hono();

sessionRouter.get('/me', authMiddleware, me);
sessionRouter.post('/refresh', rotateRefreshToken);
sessionRouter.get('/active', authMiddleware, getActiveSessions);
sessionRouter.delete('/revoke/:sessionId', authMiddleware, revokeSession);

export default sessionRouter;
