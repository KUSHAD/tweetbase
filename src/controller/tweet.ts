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

export const newTweet = zValidator('form', newTweetSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));

  const { content, media } = res.data;
  const authUser = c.get('authUser');

  const uploadedMedia = media ? await utapi.uploadFiles(media) : null;

  const [newTweet] = await db
    .insert(tweets)
    .values({
      userId: authUser.userId,
      content,
      mediaUrl: uploadedMedia?.data?.ufsUrl ?? null,
      type: 'TWEET',
    })
    .returning();

  const [updatedUser] = await db
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
    message: 'Tweeted!',
    data: {
      tweet: {
        ...newTweet,
        user: updatedUser,
        originalTweet: null,
        originalTweetUser: null,
      },
    },
  });
});

export const getTweet = zValidator('query', getTweetSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));

  const { tweetId } = res.data;

  const [tweet] = await db
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
    .where(eq(tweets.id, tweetId))
    .limit(1);

  if (!tweet)
    throw new HTTPException(404, { message: 'Tweet not found', cause: 'Invalid tweetId' });

  return c.json({
    message: 'Tweet fetched!',
    data: { tweet },
  });
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
    throw new HTTPException(404, {
      message: 'Tweet not found or not owned by user',
      cause: tweetId,
    });

  if (tweet.mediaUrl) {
    const key = getUploadthingFileKey(tweet.mediaUrl);
    await utapi.deleteFiles(key);
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
    .select({
      id: tweets.id,
      mediaUrl: tweets.mediaUrl,
      type: tweets.type,
    })
    .from(tweets)
    .where(and(eq(tweets.id, parsed.data.tweetId), eq(tweets.userId, authUser.userId)))
    .limit(1);

  if (!tweet)
    throw new HTTPException(404, {
      message: 'Tweet not found or not owned by user',
      cause: tweetId,
    });

  const { content, media } = res.data;

  if (tweet.type === 'RETWEET' && (content || media))
    throw new HTTPException(400, { message: 'Retweets cannot be edited', cause: 'Type violation' });

  if (tweet.type === 'QUOTE' && media)
    throw new HTTPException(400, {
      message: 'Quotes cannot include media',
      cause: 'Type violation',
    });

  if (!content && !media)
    throw new HTTPException(400, {
      message: 'Tweet must have content or media',
      cause: 'Empty content',
    });

  let newMediaUrl: string | null = null;
  if (media) {
    const upload = await utapi.uploadFiles(media);
    newMediaUrl = upload?.data?.ufsUrl ?? null;

    if (!newMediaUrl)
      throw new HTTPException(500, { message: 'Media upload failed', cause: 'uploadthing' });

    if (tweet.mediaUrl) {
      const prevKey = getUploadthingFileKey(tweet.mediaUrl);
      await utapi.deleteFiles(prevKey);
    }
  }

  const [updatedTweet] = await db
    .update(tweets)
    .set({
      content,
      mediaUrl: newMediaUrl ?? (media ? null : tweet.mediaUrl),
    })
    .where(and(eq(tweets.id, parsed.data.tweetId), eq(tweets.userId, authUser.userId)))
    .returning();

  const [user] = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      userName: users.userName,
    })
    .from(users)
    .where(and(eq(users.id, authUser.userId), eq(users.accountId, authUser.accountId)))
    .limit(1);

  return c.json({
    message: 'Tweet updated!',
    data: {
      tweet: {
        ...updatedTweet,
        user,
      },
    },
  });
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
      retweetCount: tweets.retweetCount,
      createdAt: tweets.createdAt,
      user: {
        id: users.id,
        displayName: users.displayName,
        userName: users.userName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(tweets)
    .where(eq(tweets.id, tweetId))
    .innerJoin(users, eq(users.id, tweets.userId))
    .limit(1);

  if (!ogTweet)
    throw new HTTPException(404, { message: 'Original tweet not found', cause: tweetId });

  if (ogTweet.userId === authUser.userId)
    throw new HTTPException(400, {
      message: 'Cannot retweet your own tweet',
      cause: 'Self-retweet',
    });

  const [alreadyRetweeted] = await db
    .select({ id: tweets.id })
    .from(tweets)
    .where(
      and(
        eq(tweets.userId, authUser.userId),
        eq(tweets.originalTweetId, tweetId),
        eq(tweets.type, 'RETWEET'),
      ),
    );

  if (alreadyRetweeted)
    throw new HTTPException(400, { message: 'Already retweeted', cause: 'Duplicate retweet' });

  const [retweet] = await db
    .insert(tweets)
    .values({
      userId: authUser.userId,
      type: 'RETWEET',
      originalTweetId: tweetId,
    })
    .returning();

  await db
    .update(tweets)
    .set({ retweetCount: sql`${tweets.retweetCount} + 1` })
    .where(eq(tweets.id, tweetId));

  await db
    .update(users)
    .set({ tweetCount: sql`${users.tweetCount} + 1` })
    .where(eq(users.id, authUser.userId));

  return c.json({
    message: 'Retweeted!',
    data: {
      tweet: {
        ...retweet,
        originalTweet: ogTweet,
        originalTweetUser: ogTweet.user,
      },
    },
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
      throw new HTTPException(400, {
        message: 'Quoted tweet must have content',
        cause: 'Empty content',
      });

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

    const [newQuote] = await db
      .insert(tweets)
      .values({
        userId: authUser.userId,
        content,
        type: 'QUOTE',
        originalTweetId: ogTweet.id,
      })
      .returning();

    await db
      .update(tweets)
      .set({ quoteCount: sql`${tweets.quoteCount} + 1` })
      .where(eq(tweets.id, ogTweet.id));

    const [updatedUser] = await db
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
      message: 'Quoted tweet successfully!',
      data: {
        tweet: {
          ...newQuote,
          user: updatedUser,
          originalTweet: ogTweet,
          originalTweetUser: ogTweet.user,
        },
      },
    });
  },
);

export const getUserTweets = zValidator(
  'query',
  getProfileSchema.and(paginationSchema),
  async (res, c) => {
    if (!res.success) throw new HTTPException(400, errorFormat(res.error));

    const { userId, limit, offset } = res.data;

    const tweets = await db
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
      .where(eq(tweets.userId, userId))
      .orderBy((t) => desc(t.createdAt))
      .offset(offset)
      .limit(limit + 1);

    const hasMore = tweets.length > limit;
    const data = hasMore ? tweets.slice(0, -1) : tweets;

    return c.json({
      message: 'Tweets fetched successfully',
      data: { tweets: data, hasMore, nextOffset: offset + data.length },
    });
  },
);
