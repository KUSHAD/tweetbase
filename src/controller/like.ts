import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db';
import { follows, tweetLikes, tweets, users } from '../db/schema';
import { errorFormat } from '../lib/utils';
import { getTweetSchema } from '../validators/tweet';
import { paginationSchema } from '../validators/utils';
import { createNotification } from './notifications';

export const likeTweet = zValidator('query', getTweetSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));

  const authUser = c.get('authUser');
  if (!authUser)
    throw new HTTPException(401, { message: 'Unauthorized', cause: 'No user session' });

  const { tweetId } = res.data;

  const [likeExists] = await db
    .select({ userId: tweetLikes.userId, tweetId: tweetLikes.tweetId })
    .from(tweetLikes)
    .where(and(eq(tweetLikes.userId, authUser.userId), eq(tweetLikes.tweetId, tweetId)))
    .limit(1);

  if (likeExists)
    throw new HTTPException(400, { message: 'Invalid Request', cause: 'Tweet already liked' });

  const [ogTweet] = await db
    .select({ ownerId: tweets.userId })
    .from(tweets)
    .where(eq(tweets.id, tweetId))
    .limit(1);

  const [data] = await db
    .insert(tweetLikes)
    .values({ tweetId, userId: authUser.userId })
    .returning({ userId: tweetLikes.userId, tweetId: tweetLikes.tweetId });

  await createNotification({
    actorId: authUser.userId,
    recipientId: ogTweet.ownerId,
    type: 'LIKE',
    tweetId: tweetId,
  });

  return c.json({ message: 'Tweet liked succesfully', data });
});

export const unlikeTweet = zValidator('query', getTweetSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));

  const authUser = c.get('authUser');
  if (!authUser)
    throw new HTTPException(401, { message: 'Unauthorized', cause: 'No user session' });

  const { tweetId } = res.data;

  const [likeExists] = await db
    .select({ userId: tweetLikes.userId, tweetId: tweetLikes.tweetId })
    .from(tweetLikes)
    .where(and(eq(tweetLikes.userId, authUser.userId), eq(tweetLikes.tweetId, tweetId)))
    .limit(1);

  if (likeExists)
    throw new HTTPException(400, { message: 'Invalid Request', cause: 'Tweet already unliked' });

  const [data] = await db
    .delete(tweetLikes)
    .where(and(eq(tweetLikes.userId, authUser.userId), eq(tweetLikes.tweetId, tweetId)))
    .returning({ userId: tweetLikes.userId, tweetId: tweetLikes.tweetId });

  return c.json({ message: 'Tweet unliked succesfully', data });
});

export const getLikes = zValidator(
  'query',
  getTweetSchema.and(paginationSchema),
  async (res, c) => {
    if (!res.success) throw new HTTPException(400, errorFormat(res.error));

    const authUser = c.get('authUser');
    if (!authUser)
      throw new HTTPException(401, { message: 'Unauthorized', cause: 'No user session' });

    const { tweetId, limit, offset } = res.data;

    const likedUsers = await db
      .select({
        id: users.id,
        userName: users.userName,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        isFollowing: sql<boolean>`EXISTS (
          SELECT 1 FROM ${follows} AS f
          WHERE f.follower_id = ${authUser.userId}
            AND f.following_id = ${users.id}
        )`,
        isMutual: sql<boolean>`EXISTS (
          SELECT 1 FROM ${follows} AS f1
          WHERE f1.follower_id = ${authUser.userId}
            AND f1.following_id = ${users.id}
        ) AND EXISTS (
          SELECT 1 FROM ${follows} AS f2
          WHERE f2.follower_id = ${users.id}
            AND f2.following_id = ${authUser.userId}
        )`,
        createdAt: tweetLikes.createdAt,
      })
      .from(tweetLikes)
      .innerJoin(users, eq(tweetLikes.userId, users.id))
      .where(eq(tweetLikes.tweetId, tweetId))
      .orderBy((t) => desc(t.createdAt))
      .offset(offset)
      .limit(limit + 1);

    const hasMore = likedUsers.length > limit;
    const data = hasMore ? likedUsers.slice(0, -1) : likedUsers;

    return c.json({
      message: 'Fetched liked users successfully',
      data: {
        users: data,
        hasMore,
        nextOffset: offset + data.length,
      },
    });
  },
);
