import { zValidator } from '@hono/zod-validator';
import { desc, eq, inArray, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db';
import { follows, tweets, users } from '../db/schema';
import { originalTweet, originalTweetUser } from '../lib/db-alias';
import { errorFormat } from '../lib/utils';
import { paginationSchema } from '../validators/utils';

export const myFeed = zValidator('query', paginationSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));

  const { limit, offset } = res.data;
  const authUser = c.get('authUser');
  if (!authUser) throw new HTTPException(401, { message: 'Unauthorized' });

  const following = await db
    .select({ followingId: follows.followingId })
    .from(follows)
    .where(eq(follows.followerId, authUser.userId));

  const followingIds = following.map((f) => f.followingId);
  followingIds.push(authUser.userId);

  const resTweets = await db
    .select({
      id: tweets.id,
      content: tweets.content,
      mediaUrl: tweets.mediaUrl,
      type: tweets.type,
      likeCount: tweets.likeCount,
      commentCount: tweets.commentCount,
      quoteCount: tweets.quoteCount,
      retweetCount: tweets.retweetCount,
      createdAt: tweets.createdAt,
      updatedAt: tweets.updatedAt,
      user: {
        id: users.id,
        displayName: users.displayName,
        userName: users.userName,
        avatarUrl: users.avatarUrl,
        // mutual info
        isFollowing: sql<boolean>`EXISTS(
          SELECT 1 FROM ${follows}
          WHERE ${follows.followerId} = ${authUser.userId}
          AND ${follows.followingId} = ${users.id}
        )`,
        isFollowedBy: sql<boolean>`EXISTS(
          SELECT 1 FROM ${follows}
          WHERE ${follows.followerId} = ${users.id}
          AND ${follows.followingId} = ${authUser.userId}
        )`,
      },
      originalTweet: {
        id: originalTweet.id,
        content: originalTweet.content,
        mediaUrl: originalTweet.mediaUrl,
        createdAt: originalTweet.createdAt,
      },
      originalTweetUser: {
        id: originalTweetUser.id,
        displayName: originalTweetUser.displayName,
        userName: originalTweetUser.userName,
        avatarUrl: originalTweetUser.avatarUrl,
      },
    })
    .from(tweets)
    .innerJoin(users, eq(tweets.userId, users.id))
    .leftJoin(originalTweet, eq(tweets.originalTweetId, originalTweet.id))
    .leftJoin(originalTweetUser, eq(originalTweet.userId, originalTweetUser.id))
    .where(inArray(tweets.userId, followingIds))
    .orderBy(desc(tweets.createdAt))
    .offset(offset)
    .limit(limit + 1);

  const hasMore = resTweets.length > limit;
  const data = hasMore ? resTweets.slice(0, -1) : resTweets;

  return c.json({
    message: 'Feed fetched successfully',
    data: { tweets: data, hasMore, nextOffset: offset + data.length },
  });
});

export const exploreFeed = zValidator('query', paginationSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));

  const { limit, offset } = res.data;
  const authUser = c.get('authUser');

  const resTweets = await db
    .select({
      id: tweets.id,
      content: tweets.content,
      mediaUrl: tweets.mediaUrl,
      type: tweets.type,
      likeCount: tweets.likeCount,
      commentCount: tweets.commentCount,
      quoteCount: tweets.quoteCount,
      retweetCount: tweets.retweetCount,
      createdAt: tweets.createdAt,
      updatedAt: tweets.updatedAt,
      user: {
        id: users.id,
        displayName: users.displayName,
        userName: users.userName,
        avatarUrl: users.avatarUrl,
        // mutual info (if logged in)
        isFollowing: authUser
          ? sql<boolean>`EXISTS(
              SELECT 1 FROM ${follows}
              WHERE ${follows.followerId} = ${authUser.userId}
              AND ${follows.followingId} = ${users.id}
            )`
          : sql<boolean>`false`,
        isFollowedBy: authUser
          ? sql<boolean>`EXISTS(
              SELECT 1 FROM ${follows}
              WHERE ${follows.followerId} = ${users.id}
              AND ${follows.followingId} = ${authUser.userId}
            )`
          : sql<boolean>`false`,
      },
      originalTweet: {
        id: originalTweet.id,
        content: originalTweet.content,
        mediaUrl: originalTweet.mediaUrl,
        createdAt: originalTweet.createdAt,
      },
      originalTweetUser: {
        id: originalTweetUser.id,
        displayName: originalTweetUser.displayName,
        userName: originalTweetUser.userName,
        avatarUrl: originalTweetUser.avatarUrl,
      },
    })
    .from(tweets)
    .innerJoin(users, eq(tweets.userId, users.id))
    .leftJoin(originalTweet, eq(tweets.originalTweetId, originalTweet.id))
    .leftJoin(originalTweetUser, eq(originalTweet.userId, originalTweetUser.id))
    .where(inArray(tweets.type, ['TWEET', 'QUOTE']))
    .orderBy(desc(tweets.likeCount), desc(tweets.createdAt))
    .offset(offset)
    .limit(limit + 1);

  const hasMore = resTweets.length > limit;
  const data = hasMore ? resTweets.slice(0, -1) : resTweets;

  return c.json({
    message: 'Explore feed fetched successfully',
    data: { tweets: data, hasMore, nextOffset: offset + data.length },
  });
});
