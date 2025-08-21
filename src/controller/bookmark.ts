import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db';
import { tweetBookmarks, tweets, users } from '../db/schema';
import { errorFormat } from '../lib/utils';
import { getTweetSchema } from '../validators/tweet';
import { paginationSchema } from '../validators/utils';

export const createBookmark = zValidator('query', getTweetSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));
  const authUser = c.get('authUser');
  const { tweetId } = res.data;

  await db
    .insert(tweetBookmarks)
    .values({ userId: authUser.userId, tweetId })
    .onConflictDoNothing();

  await db
    .update(tweets)
    .set({
      bookmarkCount: sql`${tweets.bookmarkCount} + 1`,
    })
    .where(eq(tweets.id, tweetId));

  return c.json({ message: 'Tweet bookmarked!', data: { tweetId } });
});

export const removeBookmark = zValidator('query', getTweetSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));
  const authUser = c.get('authUser');
  const { tweetId } = res.data;

  await db
    .delete(tweetBookmarks)
    .where(and(eq(tweetBookmarks.userId, authUser.userId), eq(tweetBookmarks.tweetId, tweetId)));

  await db
    .update(tweets)
    .set({
      bookmarkCount: sql`${tweets.bookmarkCount} - 1`,
    })
    .where(eq(tweets.id, tweetId));

  return c.json({ message: 'Bookmark removed!', data: { tweetId } });
});

export const getBookmarks = zValidator('query', paginationSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));
  const { limit, offset } = res.data;
  const authUser = c.get('authUser');

  const bookmarkedTweets = await db
    .select({
      id: tweets.id,
      content: tweets.content,
      mediaUrl: tweets.mediaUrl,
      type: tweets.type,
      createdAt: tweets.createdAt,
      user: {
        id: users.id,
        displayName: users.displayName,
        userName: users.userName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(tweetBookmarks)
    .innerJoin(tweets, eq(tweetBookmarks.tweetId, tweets.id))
    .innerJoin(users, eq(tweets.userId, users.id))
    .where(eq(tweetBookmarks.userId, authUser.userId))
    .orderBy(desc(tweetBookmarks.createdAt))
    .offset(offset)
    .limit(limit + 1);

  return c.json({
    message: 'Bookmarks fetched successfully',
    data: {
      tweets: bookmarkedTweets.slice(0, limit),
      hasMore: bookmarkedTweets.length > limit,
      nextOffset: offset + Math.min(bookmarkedTweets.length, limit),
    },
  });
});
