import { and, eq } from 'drizzle-orm';
import { MiddlewareHandler } from 'hono';
import { db } from '../db';
import { users } from '../db/schema';
import { decryptForgotPasswordToken, errorFormat } from '../lib/utils';
import { authorizationSchema } from '../validators/auth';

export const resetPasswordMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ message: 'Unauthorized' }, 401);
  }

  const token = authHeader.split(' ')[1];

  console.log('Token:', token);

  const result = await authorizationSchema.safeParseAsync({ token });

  if (!result.success) {
    return c.json(errorFormat(result.error), 401);
  }

  try {
    const payload = await decryptForgotPasswordToken(token);

    console.log(payload);

    if (!payload) return c.json({ message: 'Unauthorized' }, 401);

    const userExists = await db
      .select({
        userId: users.id,
        accountId: users.accountId,
      })
      .from(users)
      .where(and(eq(users.id, payload.userId), eq(users.accountId, payload.accountId)))
      .limit(1);

    if (!userExists) return c.json({ message: 'Unauthorized' }, 401);

    c.set('authUser', userExists[0]);

    await next();
  } catch (e) {
    return c.json({ message: 'Invalid token' }, 401);
  }
};
