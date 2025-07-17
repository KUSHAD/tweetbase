import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db';
import { saasFollows, saasTweetLikes, saasUsers } from '../db/schema';
import { errorFormat } from '../lib/utils';
import { getTweetSchema } from '../validators/tweet';
import { paginationSchema } from '../validators/utils';

export const likeTweet = zValidator('param', getTweetSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));

  const authUser = c.get('authUser');
  if (!authUser)
    throw new HTTPException(401, { message: 'Unauthorized', cause: 'No user session' });

  const { tweetId } = res.data;

  const [likeExists] = await db
    .select({ userId: saasTweetLikes.userId, tweetId: saasTweetLikes.tweetId })
    .from(saasTweetLikes)
    .where(and(eq(saasTweetLikes.userId, authUser.userId), eq(saasTweetLikes.tweetId, tweetId)))
    .limit(1);

  if (likeExists)
    throw new HTTPException(400, { message: 'Invalid Request', cause: 'Tweet already liked' });

  const [data] = await db
    .insert(saasTweetLikes)
    .values({ tweetId, userId: authUser.userId })
    .returning({ userId: saasTweetLikes.userId, tweetId: saasTweetLikes.tweetId });

  return c.json({ message: 'Tweet liked succesfully', data });
});

export const unlikeTweet = zValidator('param', getTweetSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));

  const authUser = c.get('authUser');
  if (!authUser)
    throw new HTTPException(401, { message: 'Unauthorized', cause: 'No user session' });

  const { tweetId } = res.data;

  const [likeExists] = await db
    .select({ userId: saasTweetLikes.userId, tweetId: saasTweetLikes.tweetId })
    .from(saasTweetLikes)
    .where(and(eq(saasTweetLikes.userId, authUser.userId), eq(saasTweetLikes.tweetId, tweetId)))
    .limit(1);

  if (likeExists)
    throw new HTTPException(400, { message: 'Invalid Request', cause: 'Tweet already unliked' });

  const [data] = await db
    .delete(saasTweetLikes)
    .where(and(eq(saasTweetLikes.userId, authUser.userId), eq(saasTweetLikes.tweetId, tweetId)))
    .returning({ userId: saasTweetLikes.userId, tweetId: saasTweetLikes.tweetId });

  return c.json({ message: 'Tweet unliked succesfully', data });
});

export const getLikes = zValidator('param', getTweetSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));

  const authUser = c.get('authUser');
  if (!authUser)
    throw new HTTPException(401, { message: 'Unauthorized', cause: 'No user session' });

  const { tweetId } = res.data;

  const parsedPagination = paginationSchema.safeParse({
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  });

  if (!parsedPagination.success) throw new HTTPException(400, errorFormat(parsedPagination.error));

  const likedUsers = await db
    .select({
      id: saasUsers.id,
      userName: saasUsers.userName,
      displayName: saasUsers.displayName,
      avatarUrl: saasUsers.avatarUrl,
      isFollowing: sql<boolean>`EXISTS (
          SELECT 1 FROM ${saasFollows} AS f
          WHERE f.follower_id = ${authUser.userId}
            AND f.following_id = ${saasUsers.id}
        )`,
      isMutual: sql<boolean>`EXISTS (
          SELECT 1 FROM ${saasFollows} AS f1
          WHERE f1.follower_id = ${authUser.userId}
            AND f1.following_id = ${saasUsers.id}
        ) AND EXISTS (
          SELECT 1 FROM ${saasFollows} AS f2
          WHERE f2.follower_id = ${saasUsers.id}
            AND f2.following_id = ${authUser.userId}
        )`,
      createdAt: saasTweetLikes.createdAt,
    })
    .from(saasTweetLikes)
    .innerJoin(saasUsers, eq(saasTweetLikes.userId, saasUsers.id))
    .where(eq(saasTweetLikes.tweetId, tweetId))
    .orderBy((t) => desc(t.createdAt))
    .offset(parsedPagination.data.offset)
    .limit(parsedPagination.data.limit + 1);

  const hasMore = likedUsers.length > parsedPagination.data.limit;
  const data = hasMore ? likedUsers.slice(0, -1) : likedUsers;

  return c.json({
    message: 'Fetched liked users successfully',
    data: {
      users: data,
      hasMore,
      nextOffset: parsedPagination.data.offset + data.length,
    },
  });
});
