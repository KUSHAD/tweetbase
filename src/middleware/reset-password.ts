import { and, eq, gt } from 'drizzle-orm';
import { MiddlewareHandler } from 'hono';
import { db } from '../db';
import { saasSessions, saasUsers } from '../db/schema';
import { decryptForgotPasswordToken, errorFormat } from '../lib/utils';
import { authorizationSchema } from '../validators/auth';

export const resetPasswordMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ message: 'Unauthorized' }, 401);
  }

  const token = authHeader.split(' ')[1];
  const result = await authorizationSchema.safeParseAsync({ token });

  if (!result.success) {
    return c.json(errorFormat(result.error), 401);
  }

  try {
    const payload = await decryptForgotPasswordToken(token);
    if (!payload) return c.json({ message: 'Unauthorized' }, 401);

    const [user] = await db
      .select({ userId: saasUsers.id, accountId: saasUsers.accountId })
      .from(saasUsers)
      .where(and(eq(saasUsers.id, payload.userId), eq(saasUsers.accountId, payload.accountId)));

    if (!user) return c.json({ message: 'Unauthorized' }, 401);

    const [session] = await db
      .select()
      .from(saasSessions)
      .where(
        and(
          eq(saasSessions.userId, payload.userId),
          eq(saasSessions.accountId, payload.accountId),
          gt(saasSessions.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!session) return c.json({ message: 'Session expired or invalid' }, 401);

    c.set('authUser', user);
    await next();
  } catch (e) {
    return c.json({ message: 'Invalid token' }, 401);
  }
};
