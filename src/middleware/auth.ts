import { and, eq, gt } from 'drizzle-orm';
import { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db';
import { saasSessions, saasUsers } from '../db/schema';
import { decryptAccessToken, errorFormat } from '../lib/utils';
import { authorizationSchema } from '../validators/auth';

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer '))
    throw new HTTPException(401, {
      message: 'Unauthorized',
      cause: 'No Bearer Token in Header to Validate',
    });

  const token = authHeader.split(' ')[1];
  const result = await authorizationSchema.safeParseAsync({ token });

  if (!result.success) throw new HTTPException(400, errorFormat(result.error));

  const payload = await decryptAccessToken(token);
  if (!payload) throw new HTTPException(401, { message: 'Unauthorized', cause: 'Token Expired' });

  const [user] = await db
    .select({ userId: saasUsers.id, accountId: saasUsers.accountId })
    .from(saasUsers)
    .where(and(eq(saasUsers.id, payload.userId), eq(saasUsers.accountId, payload.accountId)));

  if (!user)
    throw new HTTPException(401, {
      message: 'Unauthorized',
      cause: 'No user found with the decrypted id',
    });

  const [session] = await db
    .select()
    .from(saasSessions)
    .where(
      and(
        eq(saasSessions.userId, payload.userId),
        eq(saasSessions.accountId, payload.accountId),
        gt(saasSessions.expiresAt, new Date()), // session must not be expired
      ),
    )
    .limit(1);

  if (!session)
    throw new HTTPException(401, { message: 'Unauthorized', cause: 'Session expired or invalid' });

  c.set('authUser', user);
  await next();
};
