import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db';
import { tweets, users } from '../db/schema';
import { originalTweet, originalTweetUser } from '../lib/db-alias';
import { utapi } from '../lib/uploadthing';
import { errorFormat, getUploadthingFileKey } from '../lib/utils';
import { getProfileSchema } from '../validators/profile';
import { getTweetSchema, newTweetSchema } from '../validators/tweet';
import { paginationSchema } from '../validators/utils';
import { createNotification } from './notifications';

const tweetWithUserSelect = {
  id: tweets.id,
  content: tweets.content,
  mediaUrl: tweets.mediaUrl,
  type: tweets.type,
  likeCount: tweets.likeCount,
  commentCount: tweets.commentCount,
  quoteCount: tweets.quoteCount,
  retweetCount: tweets.retweetCount,
  bookmarkCount: tweets.bookmarkCount,
  createdAt: tweets.createdAt,
  updatedAt: tweets.updatedAt,
  user: {
    id: users.id,
    displayName: users.displayName,
    userName: users.userName,
    avatarUrl: users.avatarUrl,
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
};

export const newTweet = zValidator('form', newTweetSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));
  const { content, media } = res.data;
  const authUser = c.get('authUser');

  const uploadedMedia = media ? await utapi.uploadFiles(media) : null;

  const [tweet] = await db
    .insert(tweets)
    .values({
      userId: authUser.userId,
      content,
      mediaUrl: uploadedMedia?.data?.ufsUrl ?? null,
      type: 'TWEET',
    })
    .returning();

  const [user] = await db
    .update(users)
    .set({ tweetCount: sql`${users.tweetCount} + 1` })
    .where(eq(users.id, authUser.userId))
    .returning({
      id: users.id,
      displayName: users.displayName,
      userName: users.userName,
      tweetCount: users.tweetCount,
    });

  return c.json({
    message: 'Tweet created',
    data: { tweet: { ...tweet, user, originalTweet: null, originalTweetUser: null } },
  });
});

export const getTweet = zValidator('query', getTweetSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));
  const { tweetId } = res.data;

  const [tweet] = await db
    .select(tweetWithUserSelect)
    .from(tweets)
    .innerJoin(users, eq(tweets.userId, users.id))
    .leftJoin(originalTweet, eq(tweets.originalTweetId, originalTweet.id))
    .leftJoin(originalTweetUser, eq(originalTweet.userId, originalTweetUser.id))
    .where(eq(tweets.id, tweetId))
    .limit(1);

  if (!tweet) throw new HTTPException(404, { message: 'Tweet not found', cause: tweetId });

  return c.json({ message: 'Tweet fetched', data: { tweet } });
});

export const deleteTweet = zValidator('query', getTweetSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));
  const { tweetId } = res.data;
  const authUser = c.get('authUser');

  const [tweet] = await db
    .select({
      id: tweets.id,
      userId: tweets.userId,
      mediaUrl: tweets.mediaUrl,
      originalTweetId: tweets.originalTweetId,
      type: tweets.type,
    })
    .from(tweets)
    .where(and(eq(tweets.id, tweetId), eq(tweets.userId, authUser.userId)))
    .limit(1);

  if (!tweet)
    throw new HTTPException(404, { message: 'Tweet not found or not owned', cause: tweetId });

  if (tweet.mediaUrl) {
    await utapi.deleteFiles(getUploadthingFileKey(tweet.mediaUrl));
  }

  if (tweet.originalTweetId && tweet.type !== 'TWEET') {
    const field =
      tweet.type === 'RETWEET'
        ? tweets.retweetCount
        : tweet.type === 'QUOTE'
          ? tweets.quoteCount
          : null;

    if (field) {
      await db
        .update(tweets)
        .set({ [field.name]: sql`${field} - 1` })
        .where(eq(tweets.id, tweet.originalTweetId));
    }
  }

  await db.delete(tweets).where(eq(tweets.id, tweetId));
  await db
    .update(users)
    .set({ tweetCount: sql`${users.tweetCount} - 1` })
    .where(eq(users.id, authUser.userId));

  return c.json({ message: 'Tweet deleted', data: { tweetId } });
});

export const editTweet = zValidator('form', newTweetSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));
  const tweetId = c.req.param('tweetId');
  const authUser = c.get('authUser');

  const parsed = getTweetSchema.safeParse({ tweetId });
  if (!parsed.success) throw new HTTPException(400, errorFormat(parsed.error));

  const [tweet] = await db
    .select({ id: tweets.id, mediaUrl: tweets.mediaUrl, type: tweets.type })
    .from(tweets)
    .where(and(eq(tweets.id, parsed.data.tweetId), eq(tweets.userId, authUser.userId)))
    .limit(1);

  if (!tweet)
    throw new HTTPException(404, { message: 'Tweet not found or not owned', cause: tweetId });
  if (tweet.type === 'RETWEET') throw new HTTPException(400, { message: 'Cannot edit a retweet' });
  if (tweet.type === 'QUOTE' && res.data.media)
    throw new HTTPException(400, { message: 'Quotes cannot include media' });
  if (!res.data.content && !res.data.media)
    throw new HTTPException(400, { message: 'Tweet must have content or media' });

  let newMediaUrl: string | null = null;
  if (res.data.media) {
    const upload = await utapi.uploadFiles(res.data.media);
    newMediaUrl = upload?.data?.ufsUrl ?? null;
    if (!newMediaUrl) throw new HTTPException(500, { message: 'Media upload failed' });
    if (tweet.mediaUrl) await utapi.deleteFiles(getUploadthingFileKey(tweet.mediaUrl));
  }

  const [updatedTweet] = await db
    .update(tweets)
    .set({
      content: res.data.content,
      mediaUrl: newMediaUrl ?? (res.data.media ? null : tweet.mediaUrl),
    })
    .where(and(eq(tweets.id, parsed.data.tweetId), eq(tweets.userId, authUser.userId)))
    .returning();

  const [user] = await db
    .select({ id: users.id, displayName: users.displayName, userName: users.userName })
    .from(users)
    .where(eq(users.id, authUser.userId))
    .limit(1);

  return c.json({ message: 'Tweet updated', data: { tweet: { ...updatedTweet, user } } });
});

export const retweet = zValidator('query', getTweetSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));
  const { tweetId } = res.data;
  const authUser = c.get('authUser');

  const [ogTweet] = await db
    .select({
      id: tweets.id,
      userId: tweets.userId,
      content: tweets.content,
      mediaUrl: tweets.mediaUrl,
      createdAt: tweets.createdAt,
      user: {
        id: users.id,
        displayName: users.displayName,
        userName: users.userName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(tweets)
    .innerJoin(users, eq(users.id, tweets.userId))
    .where(eq(tweets.id, tweetId))
    .limit(1);

  if (!ogTweet)
    throw new HTTPException(404, { message: 'Original tweet not found', cause: tweetId });
  if (ogTweet.userId === authUser.userId)
    throw new HTTPException(400, { message: 'Cannot retweet your own tweet' });

  const [already] = await db
    .select({ id: tweets.id })
    .from(tweets)
    .where(
      and(
        eq(tweets.userId, authUser.userId),
        eq(tweets.originalTweetId, tweetId),
        eq(tweets.type, 'RETWEET'),
      ),
    );
  if (already) throw new HTTPException(400, { message: 'Already retweeted' });

  const [retweet] = await db
    .insert(tweets)
    .values({ userId: authUser.userId, type: 'RETWEET', originalTweetId: tweetId })
    .returning();
  await db
    .update(tweets)
    .set({ retweetCount: sql`${tweets.retweetCount} + 1` })
    .where(eq(tweets.id, tweetId));
  await db
    .update(users)
    .set({ tweetCount: sql`${users.tweetCount} + 1` })
    .where(eq(users.id, authUser.userId));

  await createNotification({
    actorId: authUser.userId,
    recipientId: ogTweet.userId,
    type: 'RETWEET',
    tweetId: tweetId,
  });

  return c.json({
    message: 'Retweeted',
    data: { tweet: { ...retweet, originalTweet: ogTweet, originalTweetUser: ogTweet.user } },
  });
});

export const quoteTweet = zValidator(
  'json',
  newTweetSchema.omit({ media: true }).and(getTweetSchema),
  async (res, c) => {
    if (!res.success) throw new HTTPException(400, errorFormat(res.error));
    const authUser = c.get('authUser');
    const { content, tweetId } = res.data;

    if (!content?.trim())
      throw new HTTPException(400, { message: 'Quoted tweet must have content' });

    const [ogTweet] = await db
      .select({
        id: tweets.id,
        content: tweets.content,
        mediaUrl: tweets.mediaUrl,
        createdAt: tweets.createdAt,
        user: {
          id: users.id,
          displayName: users.displayName,
          userName: users.userName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(tweets)
      .innerJoin(users, eq(users.id, tweets.userId))
      .where(eq(tweets.id, tweetId))
      .limit(1);

    if (!ogTweet)
      throw new HTTPException(404, { message: 'Original tweet not found', cause: tweetId });

    const [quote] = await db
      .insert(tweets)
      .values({ userId: authUser.userId, content, type: 'QUOTE', originalTweetId: ogTweet.id })
      .returning();
    await db
      .update(tweets)
      .set({ quoteCount: sql`${tweets.quoteCount} + 1` })
      .where(eq(tweets.id, ogTweet.id));
    const [user] = await db
      .update(users)
      .set({ tweetCount: sql`${users.tweetCount} + 1` })
      .where(eq(users.id, authUser.userId))
      .returning({
        id: users.id,
        displayName: users.displayName,
        userName: users.userName,
        tweetCount: users.tweetCount,
      });

    await createNotification({
      actorId: authUser.userId,
      recipientId: ogTweet.id,
      type: 'QUOTE',
      tweetId: ogTweet.id,
    });

    return c.json({
      message: 'Quoted tweet',
      data: { tweet: { ...quote, user, originalTweet: ogTweet, originalTweetUser: ogTweet.user } },
    });
  },
);

export const getUserTweets = zValidator(
  'query',
  getProfileSchema.and(paginationSchema),
  async (res, c) => {
    if (!res.success) throw new HTTPException(400, errorFormat(res.error));
    const { userId, limit, offset } = res.data;

    const rows = await db
      .select(tweetWithUserSelect)
      .from(tweets)
      .innerJoin(users, eq(tweets.userId, users.id))
      .leftJoin(originalTweet, eq(tweets.originalTweetId, originalTweet.id))
      .leftJoin(originalTweetUser, eq(originalTweet.userId, originalTweetUser.id))
      .where(eq(tweets.userId, userId))
      .orderBy(desc(tweets.createdAt))
      .offset(offset)
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, -1) : rows;

    return c.json({
      message: 'User tweets fetched',
      data: { tweets: data, hasMore, nextOffset: offset + data.length },
    });
  },
);
