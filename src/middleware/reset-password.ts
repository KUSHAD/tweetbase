import { and, eq, gt } from 'drizzle-orm';
import { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db';
import { standaloneSessions, standaloneUsers } from '../db/schema';
import { decryptForgotPasswordToken, errorFormat } from '../lib/utils';
import { authorizationSchema } from '../validators/auth';

export const resetPasswordMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer '))
    throw new HTTPException(401, {
      message: 'Unauthorized',
      cause: 'No Bearer Token in Header to Validate',
    });

  const token = authHeader.split(' ')[1];
  const result = await authorizationSchema.safeParseAsync({ token });

  if (!result.success) throw new HTTPException(400, errorFormat(result.error));

  const payload = await decryptForgotPasswordToken(token);
  if (!payload) throw new HTTPException(401, { message: 'Unauthorized', cause: 'Token Expired' });

  const [user] = await db
    .select({ userId: standaloneUsers.id, accountId: standaloneUsers.accountId })
    .from(standaloneUsers)
    .where(
      and(eq(standaloneUsers.id, payload.userId), eq(standaloneUsers.accountId, payload.accountId)),
    );

  if (!user)
    throw new HTTPException(401, {
      message: 'Unauthorized',
      cause: 'No user found with the decrypted id',
    });

  const [session] = await db
    .select()
    .from(standaloneSessions)
    .where(
      and(
        eq(standaloneSessions.userId, payload.userId),
        eq(standaloneSessions.accountId, payload.accountId),
        gt(standaloneSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!session)
    throw new HTTPException(401, { message: 'Unauthorized', cause: 'Session expired or invalid' });

  c.set('authUser', user);
  await next();
};
