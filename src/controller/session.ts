import { zValidator } from '@hono/zod-validator';
import { addDays } from 'date-fns';
import { and, eq, gt } from 'drizzle-orm';

import { db } from '../db';
import { standaloneSessions, standaloneUsers } from '../db/schema';

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
      id: standaloneUsers.id,
      displayName: standaloneUsers.displayName,
      userName: standaloneUsers.userName,
      avatarUrl: standaloneUsers.avatarUrl,
      bio: standaloneUsers.bio,
      website: standaloneUsers.website,
      followerCount: standaloneUsers.followerCount,
      followingCount: standaloneUsers.followingCount,
    })
    .from(standaloneUsers)
    .where(eq(standaloneUsers.id, authUser.userId));

  if (!row) throw new HTTPException(404, { message: 'User not found', cause: 'Invalid userId' });
  return c.json({ message: 'Profile', data: { user: row } });
};

export const rotateRefreshToken = zValidator('json', logoutSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));
  const { refreshToken } = res.data;

  const [session] = await db
    .select()
    .from(standaloneSessions)
    .where(eq(standaloneSessions.refreshToken, refreshToken));
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
    .update(standaloneSessions)
    .set({ refreshToken: newRefreshToken, expiresAt: addDays(new Date(), 30) })
    .where(eq(standaloneSessions.id, session.id));

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
      id: standaloneSessions.id,
      ipAddress: standaloneSessions.ipAddress,
      userAgent: standaloneSessions.userAgent,
      createdAt: standaloneSessions.createdAt,
      expiresAt: standaloneSessions.expiresAt,
    })
    .from(standaloneSessions)
    .where(
      and(
        eq(standaloneSessions.userId, authUser.userId),
        eq(standaloneSessions.accountId, authUser.accountId),
        gt(standaloneSessions.expiresAt, new Date()),
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
    .from(standaloneSessions)
    .where(
      and(
        eq(standaloneSessions.id, sessionId),
        eq(standaloneSessions.userId, authUser.userId),
        eq(standaloneSessions.accountId, authUser.accountId),
      ),
    )
    .limit(1);

  if (!session)
    throw new HTTPException(404, {
      message: 'Session not found',
      cause: 'Invalid sessionId or no permission',
    });

  await db.delete(standaloneSessions).where(eq(standaloneSessions.id, sessionId));
  return c.json({ message: 'Session revoked successfully' });
});
