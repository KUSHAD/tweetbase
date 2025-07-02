import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, notInArray, sql } from 'drizzle-orm';
import { Context } from 'hono';
import { db } from '../db';
import { saasFollows, saasUsers } from '../db/schema';
import { errorFormat } from '../lib/utils';
import { followSchema } from '../validators/network';

export const followUser = zValidator('json', followSchema, async (result, c) => {
  if (!result.success) return c.json(errorFormat(result.error), 400);

  try {
    const { targetUserId } = result.data;
    const authUser = c.get('authUser');

    if (authUser.userId === targetUserId) return c.json({ message: "Can't follow yourself" }, 400);

    const [inserted] = await db
      .insert(saasFollows)
      .values({
        followerId: authUser.userId,
        followingId: targetUserId,
      })
      .returning()
      .onConflictDoNothing();

    if (inserted) {
      // Update counts only if a new row was inserted
      await db
        .update(saasUsers)
        .set({
          followingCount: sql`${saasUsers.followingCount} + 1`,
        })
        .where(eq(saasUsers.id, authUser.userId));

      await db
        .update(saasUsers)
        .set({
          followerCount: sql`${saasUsers.followerCount} + 1`,
        })
        .where(eq(saasUsers.id, targetUserId));
    }

    return c.json({ message: 'Followed successfully' });
  } catch (error) {
    return c.json(errorFormat(error), 500);
  }
});

export const unfollowUser = zValidator('json', followSchema, async (result, c) => {
  if (!result.success) return c.json(errorFormat(result.error), 400);

  try {
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
        .set({
          followingCount: sql`${saasUsers.followingCount} - 1`,
        })
        .where(eq(saasUsers.id, authUser.userId));

      await db
        .update(saasUsers)
        .set({
          followerCount: sql`${saasUsers.followerCount} - 1`,
        })
        .where(eq(saasUsers.id, targetUserId));
    }

    return c.json({ message: 'Unfollowed successfully' });
  } catch (error) {
    return c.json(errorFormat(error), 500);
  }
});

export const getFollowers = zValidator('json', followSchema, async (res, c) => {
  if (!res.success) return c.json(errorFormat(res.error), 400);

  try {
    const { targetUserId } = res.data;

    const authUser = c.get('authUser');

    const result = await db
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
      })
      .from(saasFollows)
      .innerJoin(saasUsers, eq(saasFollows.followerId, saasUsers.id))
      .where(eq(saasFollows.followingId, targetUserId));

    return c.json({ message: 'Got followers sucessfully!', data: { followers: result } });
  } catch (error) {
    return c.json(errorFormat(error), 500);
  }
});

export const getFollowing = zValidator('json', followSchema, async (res, c) => {
  if (!res.success) return c.json(errorFormat(res.error), 400);

  try {
    const { targetUserId } = res.data;

    const authUser = c.get('authUser');

    const result = await db
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
      })
      .from(saasFollows)
      .innerJoin(saasUsers, eq(saasFollows.followingId, saasUsers.id))
      .where(eq(saasFollows.followerId, targetUserId));

    return c.json({ message: 'Got following sucessfully!', data: { following: result } });
  } catch (error) {
    return c.json(errorFormat(error), 500);
  }
});

export const getSuggestedFollows = async (c: Context) => {
  try {
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
        )`.as('mutualFollowCount'),
      })
      .from(saasUsers)
      .where(and(notInArray(saasUsers.id, [...alreadyFollowingIds, userId])))
      .orderBy((table) => [desc(table.mutualFollowCount), desc(table.followerCount)])
      .limit(10);

    return c.json({
      message: 'Suggested follows fetched successfully!',
      data: {
        suggestions,
      },
    });
  } catch (error) {
    return c.json(errorFormat(error), 500);
  }
};
