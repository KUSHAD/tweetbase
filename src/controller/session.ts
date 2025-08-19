import { zValidator } from '@hono/zod-validator';
import { addDays } from 'date-fns';
import { and, eq, gt } from 'drizzle-orm';

import { db } from '../db';
import { sessions, users } from '../db/schema';

import { errorFormat, generateAccessToken, generateRefreshToken } from '../lib/utils';

import { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { logoutSchema } from '../validators/auth';
import { revokeSessionSchema } from '../validators/session';

export const me = async (c: Context) => {
  const authUser = c.get('authUser');
  if (!authUser)
    throw new HTTPException(401, { message: 'Unauthorized', cause: 'No user session' });

  const [row] = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      userName: users.userName,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
      website: users.website,
      followerCount: users.followerCount,
      followingCount: users.followingCount,
    })
    .from(users)
    .where(eq(users.id, authUser.userId));

  if (!row) throw new HTTPException(404, { message: 'User not found', cause: 'Invalid userId' });
  return c.json({ message: 'Profile', data: { user: row } });
};

export const rotateRefreshToken = zValidator('json', logoutSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));
  const { refreshToken } = res.data;

  const [session] = await db.select().from(sessions).where(eq(sessions.refreshToken, refreshToken));
  if (!session)
    throw new HTTPException(401, { message: 'Invalid refresh token', cause: 'Session not found' });

  const newRefreshToken = await generateRefreshToken({
    userId: session.userId,
    accountId: session.accountId,
  });
  const accessToken = await generateAccessToken({
    userId: session.userId,
    accountId: session.accountId,
  });

  await db
    .update(sessions)
    .set({ refreshToken: newRefreshToken, expiresAt: addDays(new Date(), 30) })
    .where(eq(sessions.id, session.id));

  return c.json({
    message: 'Token rotated',
    data: {
      accessToken,
      refreshToken: newRefreshToken,
    },
  });
});

export const getActiveSessions = async (c: Context) => {
  const authUser = c.get('authUser');
  if (!authUser)
    throw new HTTPException(401, { message: 'Unauthorized', cause: 'No user session' });

  const sessions = await db
    .select({
      id: sessions.id,
      ipAddress: sessions.ipAddress,
      userAgent: sessions.userAgent,
      createdAt: sessions.createdAt,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, authUser.userId),
        eq(sessions.accountId, authUser.accountId),
        gt(sessions.expiresAt, new Date()),
      ),
    );

  return c.json({ message: 'Active sessions', data: { sessions } });
};

export const revokeSession = zValidator('query', revokeSessionSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));
  const { sessionId } = res.data;

  const authUser = c.get('authUser');
  if (!authUser)
    throw new HTTPException(401, { message: 'Unauthorized', cause: 'No user session' });

  const [session] = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.id, sessionId),
        eq(sessions.userId, authUser.userId),
        eq(sessions.accountId, authUser.accountId),
      ),
    )
    .limit(1);

  if (!session)
    throw new HTTPException(404, {
      message: 'Session not found',
      cause: 'Invalid sessionId or no permission',
    });

  await db.delete(sessions).where(eq(sessions.id, sessionId));
  return c.json({ message: 'Session revoked successfully' });
});
