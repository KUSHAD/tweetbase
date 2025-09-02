import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, notInArray, sql } from 'drizzle-orm';
import { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db';
import { follows, users } from '../db/schema';
import { errorFormat } from '../lib/utils';
import { followSchema } from '../validators/network';
import { paginationSchema } from '../validators/utils';
import { createNotification } from './notifications';

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
    .insert(follows)
    .values({ followerId: authUser.userId, followingId: targetUserId })
    .onConflictDoNothing()
    .returning();

  if (inserted) {
    await db
      .update(users)
      .set({ followingCount: sql`${users.followingCount} + 1` })
      .where(eq(users.id, authUser.userId));

    await db
      .update(users)
      .set({ followerCount: sql`${users.followerCount} + 1` })
      .where(eq(users.id, targetUserId));
  }

  c.executionCtx.waitUntil(
    (async () => {
      await createNotification({
        actorId: authUser.userId,
        recipientId: targetUserId,
        type: 'FOLLOW',
      });
    })(),
  );

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
    .delete(follows)
    .where(and(eq(follows.followerId, authUser.userId), eq(follows.followingId, targetUserId)))
    .returning();

  if (deleted) {
    await db
      .update(users)
      .set({ followingCount: sql`${users.followingCount} - 1` })
      .where(eq(users.id, authUser.userId));

    await db
      .update(users)
      .set({ followerCount: sql`${users.followerCount} - 1` })
      .where(eq(users.id, targetUserId));
  }

  return c.json({
    message: 'Unfollowed successfully',
    data: { deleted },
  });
});

export const getFollowers = zValidator(
  'query',
  followSchema.and(paginationSchema),
  async (res, c) => {
    if (!res.success) throw new HTTPException(400, errorFormat(res.error));

    const { targetUserId, limit, offset } = res.data;

    const authUser = c.get('authUser');

    const followers = await db
      .select({
        id: users.id,
        userName: users.userName,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        isMutual: sql<boolean>`EXISTS (
        SELECT 1 FROM standalone_follows AS f2
        WHERE f2.follower_id = ${authUser.userId}
        AND f2.following_id = ${users.id}
      )`.as('isMutual'),
        tweetCount: users.tweetCount,
      })
      .from(follows)
      .innerJoin(users, eq(follows.followerId, users.id))
      .where(eq(follows.followingId, targetUserId))
      .orderBy(() => [desc(follows.createdAt), desc(users.id)])
      .offset(offset)
      .limit(limit + 1);

    const hasMore = followers.length > limit;
    const data = hasMore ? followers.slice(0, -1) : followers;

    return c.json({
      message: 'Followers fetched successfully',
      data: { followers: data, hasMore, nextOffset: offset + data.length },
    });
  },
);

export const getFollowing = zValidator(
  'query',
  followSchema.and(paginationSchema),
  async (res, c) => {
    if (!res.success) throw new HTTPException(400, errorFormat(res.error));

    const { targetUserId, limit, offset } = res.data;

    const authUser = c.get('authUser');

    const following = await db
      .select({
        id: users.id,
        userName: users.userName,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        isMutual: sql<boolean>`EXISTS (
        SELECT 1 FROM standalone_follows AS f2
        WHERE f2.follower_id = ${users.id}
        AND f2.following_id = ${authUser.userId}
      )`.as('isMutual'),
        tweetCount: users.tweetCount,
      })
      .from(follows)
      .innerJoin(users, eq(follows.followingId, users.id))
      .where(eq(follows.followerId, targetUserId))
      .orderBy(() => [desc(follows.createdAt), desc(users.id)])
      .offset(offset)
      .limit(limit + 1);

    const hasMore = following.length > limit;
    const data = hasMore ? following.slice(0, -1) : following;

    return c.json({
      message: 'Following fetched successfully',
      data: { following: data, hasMore, nextOffset: offset + data.length },
    });
  },
);

export const getSuggestedFollows = async (c: Context) => {
  const authUser = c.get('authUser');
  const userId = authUser.userId;

  const alreadyFollowing = await db
    .select({ id: follows.followingId })
    .from(follows)
    .where(eq(follows.followerId, userId));

  const alreadyFollowingIds = alreadyFollowing.map((f) => f.id);

  const suggestions = await db
    .select({
      id: users.id,
      userName: users.userName,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
      followerCount: users.followerCount,
      mutualFollowCount: sql<number>`(
        SELECT COUNT(*) FROM standalone_follows AS f2
        WHERE f2.follower_id IN (
          SELECT following_id FROM standalone_follows
          WHERE follower_id = ${userId}
        )
        AND f2.following_id = ${users.id}
      )`
        .mapWith(Number)
        .as('mutualFollowCount'),
      tweetCount: users.tweetCount,
    })
    .from(users)
    .where(and(notInArray(users.id, [...alreadyFollowingIds, userId])))
    .orderBy((t) => [desc(t.mutualFollowCount), desc(t.followerCount)])
    .limit(10);

  return c.json({
    message: 'Suggested follows fetched successfully',
    data: { suggestions },
  });
};
