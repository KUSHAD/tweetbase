import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db';
import { standaloneFollows, standaloneTweetLikes, standaloneUsers } from '../db/schema';
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
    .select({ userId: standaloneTweetLikes.userId, tweetId: standaloneTweetLikes.tweetId })
    .from(standaloneTweetLikes)
    .where(
      and(
        eq(standaloneTweetLikes.userId, authUser.userId),
        eq(standaloneTweetLikes.tweetId, tweetId),
      ),
    )
    .limit(1);

  if (likeExists)
    throw new HTTPException(400, { message: 'Invalid Request', cause: 'Tweet already liked' });

  const [data] = await db
    .insert(standaloneTweetLikes)
    .values({ tweetId, userId: authUser.userId })
    .returning({ userId: standaloneTweetLikes.userId, tweetId: standaloneTweetLikes.tweetId });

  return c.json({ message: 'Tweet liked succesfully', data });
});

export const unlikeTweet = zValidator('param', getTweetSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));

  const authUser = c.get('authUser');
  if (!authUser)
    throw new HTTPException(401, { message: 'Unauthorized', cause: 'No user session' });

  const { tweetId } = res.data;

  const [likeExists] = await db
    .select({ userId: standaloneTweetLikes.userId, tweetId: standaloneTweetLikes.tweetId })
    .from(standaloneTweetLikes)
    .where(
      and(
        eq(standaloneTweetLikes.userId, authUser.userId),
        eq(standaloneTweetLikes.tweetId, tweetId),
      ),
    )
    .limit(1);

  if (likeExists)
    throw new HTTPException(400, { message: 'Invalid Request', cause: 'Tweet already unliked' });

  const [data] = await db
    .delete(standaloneTweetLikes)
    .where(
      and(
        eq(standaloneTweetLikes.userId, authUser.userId),
        eq(standaloneTweetLikes.tweetId, tweetId),
      ),
    )
    .returning({ userId: standaloneTweetLikes.userId, tweetId: standaloneTweetLikes.tweetId });

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
      id: standaloneUsers.id,
      userName: standaloneUsers.userName,
      displayName: standaloneUsers.displayName,
      avatarUrl: standaloneUsers.avatarUrl,
      isFollowing: sql<boolean>`EXISTS (
          SELECT 1 FROM ${standaloneFollows} AS f
          WHERE f.follower_id = ${authUser.userId}
            AND f.following_id = ${standaloneUsers.id}
        )`,
      isMutual: sql<boolean>`EXISTS (
          SELECT 1 FROM ${standaloneFollows} AS f1
          WHERE f1.follower_id = ${authUser.userId}
            AND f1.following_id = ${standaloneUsers.id}
        ) AND EXISTS (
          SELECT 1 FROM ${standaloneFollows} AS f2
          WHERE f2.follower_id = ${standaloneUsers.id}
            AND f2.following_id = ${authUser.userId}
        )`,
      createdAt: standaloneTweetLikes.createdAt,
    })
    .from(standaloneTweetLikes)
    .innerJoin(standaloneUsers, eq(standaloneTweetLikes.userId, standaloneUsers.id))
    .where(eq(standaloneTweetLikes.tweetId, tweetId))
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
