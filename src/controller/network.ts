import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, notInArray, sql } from 'drizzle-orm';
import { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db';
import { saasFollows, saasUsers } from '../db/schema';
import { errorFormat } from '../lib/utils';
import { followSchema } from '../validators/network';

export const followUser = zValidator('json', followSchema, async (result, c) => {
  if (!result.success) throw new HTTPException(400, errorFormat(result.error));

  const { targetUserId } = result.data;
  const authUser = c.get('authUser');

  if (authUser.userId === targetUserId)
    throw new HTTPException(400, {
      message: "Can't follow yourself",
      cause: 'User tried to follow self',
    });

  const [inserted] = await db
    .insert(saasFollows)
    .values({ followerId: authUser.userId, followingId: targetUserId })
    .onConflictDoNothing()
    .returning();

  if (inserted) {
    await db
      .update(saasUsers)
      .set({ followingCount: sql`${saasUsers.followingCount} + 1` })
      .where(eq(saasUsers.id, authUser.userId));

    await db
      .update(saasUsers)
      .set({ followerCount: sql`${saasUsers.followerCount} + 1` })
      .where(eq(saasUsers.id, targetUserId));
  }

  return c.json({
    message: 'Followed successfully',
    data: { inserted },
  });
});

export const unfollowUser = zValidator('json', followSchema, async (result, c) => {
  if (!result.success) throw new HTTPException(400, errorFormat(result.error));

  const { targetUserId } = result.data;
  const authUser = c.get('authUser');

  const [deleted] = await db
    .delete(saasFollows)
    .where(
      and(eq(saasFollows.followerId, authUser.userId), eq(saasFollows.followingId, targetUserId)),
    )
    .returning();

  if (deleted) {
    await db
      .update(saasUsers)
      .set({ followingCount: sql`${saasUsers.followingCount} - 1` })
      .where(eq(saasUsers.id, authUser.userId));

    await db
      .update(saasUsers)
      .set({ followerCount: sql`${saasUsers.followerCount} - 1` })
      .where(eq(saasUsers.id, targetUserId));
  }

  return c.json({
    message: 'Unfollowed successfully',
    data: { deleted },
  });
});

export const getFollowers = zValidator('param', followSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));

  const { targetUserId } = res.data;
  const authUser = c.get('authUser');

  const followers = await db
    .select({
      id: saasUsers.id,
      userName: saasUsers.userName,
      displayName: saasUsers.displayName,
      avatarUrl: saasUsers.avatarUrl,
      isMutual: sql<boolean>`EXISTS (
        SELECT 1 FROM saas_follows AS f2
        WHERE f2.follower_id = ${authUser.userId}
        AND f2.following_id = ${saasUsers.id}
      )`.as('isMutual'),
      tweetCount: saasUsers.tweetCount,
    })
    .from(saasFollows)
    .innerJoin(saasUsers, eq(saasFollows.followerId, saasUsers.id))
    .where(eq(saasFollows.followingId, targetUserId));

  return c.json({
    message: 'Followers fetched successfully',
    data: { followers },
  });
});

export const getFollowing = zValidator('param', followSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));

  const { targetUserId } = res.data;
  const authUser = c.get('authUser');

  const following = await db
    .select({
      id: saasUsers.id,
      userName: saasUsers.userName,
      displayName: saasUsers.displayName,
      avatarUrl: saasUsers.avatarUrl,
      isMutual: sql<boolean>`EXISTS (
        SELECT 1 FROM saas_follows AS f2
        WHERE f2.follower_id = ${saasUsers.id}
        AND f2.following_id = ${authUser.userId}
      )`.as('isMutual'),
      tweetCount: saasUsers.tweetCount,
    })
    .from(saasFollows)
    .innerJoin(saasUsers, eq(saasFollows.followingId, saasUsers.id))
    .where(eq(saasFollows.followerId, targetUserId));

  return c.json({
    message: 'Following fetched successfully',
    data: { following },
  });
});

export const getSuggestedFollows = async (c: Context) => {
  const authUser = c.get('authUser');
  const userId = authUser.userId;

  const alreadyFollowing = await db
    .select({ id: saasFollows.followingId })
    .from(saasFollows)
    .where(eq(saasFollows.followerId, userId));

  const alreadyFollowingIds = alreadyFollowing.map((f) => f.id);

  const suggestions = await db
    .select({
      id: saasUsers.id,
      userName: saasUsers.userName,
      displayName: saasUsers.displayName,
      avatarUrl: saasUsers.avatarUrl,
      bio: saasUsers.bio,
      followerCount: saasUsers.followerCount,
      mutualFollowCount: sql<number>`(
        SELECT COUNT(*) FROM saas_follows AS f2
        WHERE f2.follower_id IN (
          SELECT following_id FROM saas_follows
          WHERE follower_id = ${userId}
        )
        AND f2.following_id = ${saasUsers.id}
      )`
        .mapWith(Number)
        .as('mutualFollowCount'),
      tweetCount: saasUsers.tweetCount,
    })
    .from(saasUsers)
    .where(and(notInArray(saasUsers.id, [...alreadyFollowingIds, userId])))
    .orderBy((t) => [desc(t.mutualFollowCount), desc(t.followerCount)])
    .limit(10);

  return c.json({
    message: 'Suggested follows fetched successfully',
    data: { suggestions },
  });
};
