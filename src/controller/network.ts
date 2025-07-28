import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, notInArray, sql } from 'drizzle-orm';
import { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db';
import { standaloneFollows, standaloneUsers } from '../db/schema';
import { errorFormat } from '../lib/utils';
import { followSchema } from '../validators/network';
import { paginationSchema } from '../validators/utils';

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
    .insert(standaloneFollows)
    .values({ followerId: authUser.userId, followingId: targetUserId })
    .onConflictDoNothing()
    .returning();

  if (inserted) {
    await db
      .update(standaloneUsers)
      .set({ followingCount: sql`${standaloneUsers.followingCount} + 1` })
      .where(eq(standaloneUsers.id, authUser.userId));

    await db
      .update(standaloneUsers)
      .set({ followerCount: sql`${standaloneUsers.followerCount} + 1` })
      .where(eq(standaloneUsers.id, targetUserId));
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
    .delete(standaloneFollows)
    .where(
      and(
        eq(standaloneFollows.followerId, authUser.userId),
        eq(standaloneFollows.followingId, targetUserId),
      ),
    )
    .returning();

  if (deleted) {
    await db
      .update(standaloneUsers)
      .set({ followingCount: sql`${standaloneUsers.followingCount} - 1` })
      .where(eq(standaloneUsers.id, authUser.userId));

    await db
      .update(standaloneUsers)
      .set({ followerCount: sql`${standaloneUsers.followerCount} - 1` })
      .where(eq(standaloneUsers.id, targetUserId));
  }

  return c.json({
    message: 'Unfollowed successfully',
    data: { deleted },
  });
});

export const getFollowers = zValidator('param', followSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));

  const { targetUserId } = res.data;

  const parsedPagination = paginationSchema.safeParse({
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  });

  if (!parsedPagination.success) throw new HTTPException(400, errorFormat(parsedPagination.error));

  const authUser = c.get('authUser');

  const followers = await db
    .select({
      id: standaloneUsers.id,
      userName: standaloneUsers.userName,
      displayName: standaloneUsers.displayName,
      avatarUrl: standaloneUsers.avatarUrl,
      isMutual: sql<boolean>`EXISTS (
        SELECT 1 FROM standalone_follows AS f2
        WHERE f2.follower_id = ${authUser.userId}
        AND f2.following_id = ${standaloneUsers.id}
      )`.as('isMutual'),
      tweetCount: standaloneUsers.tweetCount,
    })
    .from(standaloneFollows)
    .innerJoin(standaloneUsers, eq(standaloneFollows.followerId, standaloneUsers.id))
    .where(eq(standaloneFollows.followingId, targetUserId))
    .orderBy(() => [desc(standaloneFollows.createdAt), desc(standaloneUsers.id)])
    .offset(parsedPagination.data.offset)
    .limit(parsedPagination.data.limit + 1);

  const hasMore = followers.length > parsedPagination.data.limit;
  const data = hasMore ? followers.slice(0, -1) : followers;

  return c.json({
    message: 'Followers fetched successfully',
    data: { followers: data, hasMore, nextOffset: parsedPagination.data.offset + data.length },
  });
});

export const getFollowing = zValidator('param', followSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));

  const { targetUserId } = res.data;

  const parsedPagination = paginationSchema.safeParse({
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  });

  if (!parsedPagination.success) throw new HTTPException(400, errorFormat(parsedPagination.error));

  const authUser = c.get('authUser');

  const following = await db
    .select({
      id: standaloneUsers.id,
      userName: standaloneUsers.userName,
      displayName: standaloneUsers.displayName,
      avatarUrl: standaloneUsers.avatarUrl,
      isMutual: sql<boolean>`EXISTS (
        SELECT 1 FROM standalone_follows AS f2
        WHERE f2.follower_id = ${standaloneUsers.id}
        AND f2.following_id = ${authUser.userId}
      )`.as('isMutual'),
      tweetCount: standaloneUsers.tweetCount,
    })
    .from(standaloneFollows)
    .innerJoin(standaloneUsers, eq(standaloneFollows.followingId, standaloneUsers.id))
    .where(eq(standaloneFollows.followerId, targetUserId))
    .orderBy(() => [desc(standaloneFollows.createdAt), desc(standaloneUsers.id)])
    .offset(parsedPagination.data.offset)
    .limit(parsedPagination.data.limit + 1);

  const hasMore = following.length > parsedPagination.data.limit;
  const data = hasMore ? following.slice(0, -1) : following;

  return c.json({
    message: 'Following fetched successfully',
    data: { following: data, hasMore, nextOffset: parsedPagination.data.offset + data.length },
  });
});

export const getSuggestedFollows = async (c: Context) => {
  const authUser = c.get('authUser');
  const userId = authUser.userId;

  const alreadyFollowing = await db
    .select({ id: standaloneFollows.followingId })
    .from(standaloneFollows)
    .where(eq(standaloneFollows.followerId, userId));

  const alreadyFollowingIds = alreadyFollowing.map((f) => f.id);

  const suggestions = await db
    .select({
      id: standaloneUsers.id,
      userName: standaloneUsers.userName,
      displayName: standaloneUsers.displayName,
      avatarUrl: standaloneUsers.avatarUrl,
      bio: standaloneUsers.bio,
      followerCount: standaloneUsers.followerCount,
      mutualFollowCount: sql<number>`(
        SELECT COUNT(*) FROM standalone_follows AS f2
        WHERE f2.follower_id IN (
          SELECT following_id FROM standalone_follows
          WHERE follower_id = ${userId}
        )
        AND f2.following_id = ${standaloneUsers.id}
      )`
        .mapWith(Number)
        .as('mutualFollowCount'),
      tweetCount: standaloneUsers.tweetCount,
    })
    .from(standaloneUsers)
    .where(and(notInArray(standaloneUsers.id, [...alreadyFollowingIds, userId])))
    .orderBy((t) => [desc(t.mutualFollowCount), desc(t.followerCount)])
    .limit(10);

  return c.json({
    message: 'Suggested follows fetched successfully',
    data: { suggestions },
  });
};
