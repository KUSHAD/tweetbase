import { zValidator } from '@hono/zod-validator';
import { addDays } from 'date-fns';
import { and, eq, gt } from 'drizzle-orm';

import { db } from '../db';
import { saasSessions, saasUsers } from '../db/schema';

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
      id: saasUsers.id,
      displayName: saasUsers.displayName,
      userName: saasUsers.userName,
      avatarUrl: saasUsers.avatarUrl,
      bio: saasUsers.bio,
      website: saasUsers.website,
      followerCount: saasUsers.followerCount,
      followingCount: saasUsers.followingCount,
    })
    .from(saasUsers)
    .where(eq(saasUsers.id, authUser.userId));

  if (!row) throw new HTTPException(404, { message: 'User not found', cause: 'Invalid userId' });
  return c.json({ message: 'Profile', data: { user: row } });
};

export const rotateRefreshToken = zValidator('json', logoutSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));
  const { refreshToken } = res.data;

  const [session] = await db
    .select()
    .from(saasSessions)
    .where(eq(saasSessions.refreshToken, refreshToken));
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
    .update(saasSessions)
    .set({ refreshToken: newRefreshToken, expiresAt: addDays(new Date(), 30) })
    .where(eq(saasSessions.id, session.id));

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
      id: saasSessions.id,
      ipAddress: saasSessions.ipAddress,
      userAgent: saasSessions.userAgent,
      createdAt: saasSessions.createdAt,
      expiresAt: saasSessions.expiresAt,
    })
    .from(saasSessions)
    .where(
      and(
        eq(saasSessions.userId, authUser.userId),
        eq(saasSessions.accountId, authUser.accountId),
        gt(saasSessions.expiresAt, new Date()),
      ),
    );

  return c.json({ message: 'Active sessions', data: { sessions } });
};

export const revokeSession = zValidator('param', revokeSessionSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));
  const { sessionId } = res.data;

  const authUser = c.get('authUser');
  if (!authUser)
    throw new HTTPException(401, { message: 'Unauthorized', cause: 'No user session' });

  const [session] = await db
    .select()
    .from(saasSessions)
    .where(
      and(
        eq(saasSessions.id, sessionId),
        eq(saasSessions.userId, authUser.userId),
        eq(saasSessions.accountId, authUser.accountId),
      ),
    )
    .limit(1);

  if (!session)
    throw new HTTPException(404, {
      message: 'Session not found',
      cause: 'Invalid sessionId or no permission',
    });

  await db.delete(saasSessions).where(eq(saasSessions.id, sessionId));
  return c.json({ message: 'Session revoked successfully' });
});
