import { zValidator } from '@hono/zod-validator';
import { and, eq, sql } from 'drizzle-orm';
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
