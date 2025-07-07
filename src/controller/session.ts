import { zValidator } from '@hono/zod-validator';
import { addDays } from 'date-fns';
import { and, eq, gt } from 'drizzle-orm';
import { Context } from 'vm';
import { db } from '../db';
import { saasSessions, saasUsers } from '../db/schema';
import { errorFormat, generateAccessToken, generateRefreshToken } from '../lib/utils';
import { logoutSchema } from '../validators/auth';
import { revokeSessionSchema } from '../validators/session';

export const me = async (c: Context) => {
  const authUser = c.get('authUser');
  if (!authUser) return c.json({ message: 'Unauthorized' }, 401);

  try {
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

    if (!row) return c.json({ message: 'User not found' }, 404);
    return c.json({ message: 'Profile', data: { user: row } });
  } catch (e) {
    return c.json(errorFormat(e), 500);
  }
};

export const rotateRefreshToken = zValidator('json', logoutSchema, async (res, c) => {
  if (!res.success) return c.json(errorFormat(res.error), 400);
  const { refreshToken } = res.data;

  try {
    const [session] = await db
      .select()
      .from(saasSessions)
      .where(eq(saasSessions.refreshToken, refreshToken));
    if (!session) return c.json({ message: 'Invalid refresh token' }, 401);

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
  } catch (e) {
    return c.json(errorFormat(e), 500);
  }
});

export const getActiveSessions = async (c: Context) => {
  const authUser = c.get('authUser');
  if (!authUser) return c.json({ message: 'Unauthorized' }, 401);

  try {
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
          gt(saasSessions.expiresAt, new Date()), // filter only active sessions
        ),
      );

    return c.json({ message: 'Active sessions', data: { sessions } });
  } catch (e) {
    return c.json(errorFormat(e), 500);
  }
};

export const revokeSession = zValidator('param', revokeSessionSchema, async (res, c) => {
  if (!res.success) return c.json(errorFormat(res.error), 400);
  const { sessionId } = res.data;

  const authUser = c.get('authUser');
  if (!authUser) return c.json({ message: 'Unauthorized' }, 401);

  try {
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

    if (!session) return c.json({ message: 'Session not found' }, 404);

    await db.delete(saasSessions).where(eq(saasSessions.id, sessionId));

    return c.json({ message: 'Session revoked successfully' });
  } catch (e) {
    return c.json(errorFormat(e), 500);
  }
});
