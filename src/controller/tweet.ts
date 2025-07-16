import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db';
import { saasTweets, saasUsers } from '../db/schema';
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
    .insert(saasTweets)
    .values({
      userId: authUser.userId,
      content,
      mediaUrl: uploadedMedia?.data?.ufsUrl ?? null,
      type: 'TWEET',
    })
    .returning();

  const [updatedUser] = await db
    .update(saasUsers)
    .set({ tweetCount: sql`${saasUsers.tweetCount} + 1` })
    .where(eq(saasUsers.id, authUser.userId))
    .returning({
      id: saasUsers.id,
      displayName: saasUsers.displayName,
      userName: saasUsers.userName,
      tweetCount: saasUsers.tweetCount,
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

export const getTweet = zValidator('param', getTweetSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));

  const { tweetId } = res.data;

  const [tweet] = await db
    .select({
      id: saasTweets.id,
      content: saasTweets.content,
      mediaUrl: saasTweets.mediaUrl,
      type: saasTweets.type,
      likeCount: saasTweets.likeCount,
      commentCount: saasTweets.commentCount,
      quoteCount: saasTweets.quoteCount,
      retweetCount: saasTweets.retweetCount,
      createdAt: saasTweets.createdAt,
      updatedAt: saasTweets.updatedAt,
      user: {
        id: saasUsers.id,
        displayName: saasUsers.displayName,
        userName: saasUsers.userName,
        avatarUrl: saasUsers.avatarUrl,
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
    .from(saasTweets)
    .innerJoin(saasUsers, eq(saasTweets.userId, saasUsers.id))
    .leftJoin(originalTweet, eq(saasTweets.originalTweetId, originalTweet.id))
    .leftJoin(originalTweetUser, eq(originalTweet.userId, originalTweetUser.id))
    .where(eq(saasTweets.id, tweetId))
    .limit(1);

  if (!tweet)
    throw new HTTPException(404, { message: 'Tweet not found', cause: 'Invalid tweetId' });

  return c.json({
    message: 'Tweet fetched!',
    data: { tweet },
  });
});

export const deleteTweet = zValidator('param', getTweetSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));

  const { tweetId } = res.data;
  const authUser = c.get('authUser');

  const [tweet] = await db
    .select({
      id: saasTweets.id,
      userId: saasTweets.userId,
      mediaUrl: saasTweets.mediaUrl,
      originalTweetId: saasTweets.originalTweetId,
      type: saasTweets.type,
    })
    .from(saasTweets)
    .where(and(eq(saasTweets.id, tweetId), eq(saasTweets.userId, authUser.userId)))
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
        ? saasTweets.retweetCount
        : tweet.type === 'QUOTE'
          ? saasTweets.quoteCount
          : null;

    if (field) {
      await db
        .update(saasTweets)
        .set({ [field.name]: sql`${field} - 1` })
        .where(eq(saasTweets.id, tweet.originalTweetId));
    }
  }

  await db.delete(saasTweets).where(eq(saasTweets.id, tweetId));

  await db
    .update(saasUsers)
    .set({ tweetCount: sql`${saasUsers.tweetCount} - 1` })
    .where(eq(saasUsers.id, authUser.userId));

  return c.json({ message: 'Tweet deleted', data: { tweetId } });
});

export const editTweet = zValidator('form', newTweetSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));

  const tweetId = c.req.param('tweetId');
  const authUser = c.get('authUser');

  const parsed = getTweetSchema.safeParse({ tweetId });
  if (!parsed.success) throw new HTTPException(400, errorFormat(parsed.error));

  const [tweet] = await db
    .select({ id: saasTweets.id, mediaUrl: saasTweets.mediaUrl, type: saasTweets.type })
    .from(saasTweets)
    .where(and(eq(saasTweets.id, parsed.data.tweetId), eq(saasTweets.userId, authUser.userId)))
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
    .update(saasTweets)
    .set({
      content,
      mediaUrl: newMediaUrl ?? (media ? null : tweet.mediaUrl),
    })
    .where(and(eq(saasTweets.id, parsed.data.tweetId), eq(saasTweets.userId, authUser.userId)))
    .returning();

  const [user] = await db
    .select({
      id: saasUsers.id,
      displayName: saasUsers.displayName,
      userName: saasUsers.userName,
    })
    .from(saasUsers)
    .where(and(eq(saasUsers.id, authUser.userId), eq(saasUsers.accountId, authUser.accountId)))
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

export const retweet = zValidator('param', getTweetSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));

  const { tweetId } = res.data;
  const authUser = c.get('authUser');

  const [ogTweet] = await db
    .select({
      id: saasTweets.id,
      userId: saasTweets.userId,
      content: saasTweets.content,
      mediaUrl: saasTweets.mediaUrl,
      retweetCount: saasTweets.retweetCount,
      createdAt: saasTweets.createdAt,
      user: {
        id: saasUsers.id,
        displayName: saasUsers.displayName,
        userName: saasUsers.userName,
        avatarUrl: saasUsers.avatarUrl,
      },
    })
    .from(saasTweets)
    .where(eq(saasTweets.id, tweetId))
    .innerJoin(saasUsers, eq(saasUsers.id, saasTweets.userId))
    .limit(1);

  if (!ogTweet)
    throw new HTTPException(404, { message: 'Original tweet not found', cause: tweetId });

  if (ogTweet.userId === authUser.userId)
    throw new HTTPException(400, {
      message: 'Cannot retweet your own tweet',
      cause: 'Self-retweet',
    });

  const [alreadyRetweeted] = await db
    .select({ id: saasTweets.id })
    .from(saasTweets)
    .where(
      and(
        eq(saasTweets.userId, authUser.userId),
        eq(saasTweets.originalTweetId, tweetId),
        eq(saasTweets.type, 'RETWEET'),
      ),
    );

  if (alreadyRetweeted)
    throw new HTTPException(400, { message: 'Already retweeted', cause: 'Duplicate retweet' });

  const [retweet] = await db
    .insert(saasTweets)
    .values({
      userId: authUser.userId,
      type: 'RETWEET',
      originalTweetId: tweetId,
    })
    .returning();

  await db
    .update(saasTweets)
    .set({ retweetCount: sql`${saasTweets.retweetCount} + 1` })
    .where(eq(saasTweets.id, tweetId));

  await db
    .update(saasUsers)
    .set({ tweetCount: sql`${saasUsers.tweetCount} + 1` })
    .where(eq(saasUsers.id, authUser.userId));

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
  newTweetSchema.omit({ media: true }),
  async (res, c) => {
    if (!res.success) throw new HTTPException(400, errorFormat(res.error));

    const tweetId = c.req.param('tweetId');
    const safeId = getTweetSchema.safeParse({ tweetId });
    if (!safeId.success) throw new HTTPException(400, errorFormat(safeId.error));

    const authUser = c.get('authUser');
    const { content } = res.data;

    if (!content?.trim())
      throw new HTTPException(400, {
        message: 'Quoted tweet must have content',
        cause: 'Empty content',
      });

    const [ogTweet] = await db
      .select({
        id: saasTweets.id,
        content: saasTweets.content,
        mediaUrl: saasTweets.mediaUrl,
        createdAt: saasTweets.createdAt,
        user: {
          id: saasUsers.id,
          displayName: saasUsers.displayName,
          userName: saasUsers.userName,
          avatarUrl: saasUsers.avatarUrl,
        },
      })
      .from(saasTweets)
      .innerJoin(saasUsers, eq(saasUsers.id, saasTweets.userId))
      .where(eq(saasTweets.id, safeId.data.tweetId))
      .limit(1);

    if (!ogTweet)
      throw new HTTPException(404, { message: 'Original tweet not found', cause: tweetId });

    const [newQuote] = await db
      .insert(saasTweets)
      .values({
        userId: authUser.userId,
        content,
        type: 'QUOTE',
        originalTweetId: ogTweet.id,
      })
      .returning();

    await db
      .update(saasTweets)
      .set({ quoteCount: sql`${saasTweets.quoteCount} + 1` })
      .where(eq(saasTweets.id, ogTweet.id));

    const [updatedUser] = await db
      .update(saasUsers)
      .set({ tweetCount: sql`${saasUsers.tweetCount} + 1` })
      .where(eq(saasUsers.id, authUser.userId))
      .returning({
        id: saasUsers.id,
        displayName: saasUsers.displayName,
        userName: saasUsers.userName,
        tweetCount: saasUsers.tweetCount,
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

export const getUserTweets = zValidator('param', getProfileSchema, async (res, c) => {
  if (!res.success) throw new HTTPException(400, errorFormat(res.error));

  const { userId } = res.data;

  const parsedPagination = paginationSchema.safeParse({
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  });

  if (!parsedPagination.success) throw new HTTPException(400, errorFormat(parsedPagination.error));

  const tweets = await db
    .select({
      id: saasTweets.id,
      content: saasTweets.content,
      mediaUrl: saasTweets.mediaUrl,
      type: saasTweets.type,
      likeCount: saasTweets.likeCount,
      commentCount: saasTweets.commentCount,
      quoteCount: saasTweets.quoteCount,
      retweetCount: saasTweets.retweetCount,
      createdAt: saasTweets.createdAt,
      updatedAt: saasTweets.updatedAt,
      user: {
        id: saasUsers.id,
        displayName: saasUsers.displayName,
        userName: saasUsers.userName,
        avatarUrl: saasUsers.avatarUrl,
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
    .from(saasTweets)
    .innerJoin(saasUsers, eq(saasTweets.userId, saasUsers.id))
    .leftJoin(originalTweet, eq(saasTweets.originalTweetId, originalTweet.id))
    .leftJoin(originalTweetUser, eq(originalTweet.userId, originalTweetUser.id))
    .where(eq(saasTweets.userId, userId))
    .orderBy((t) => desc(t.createdAt))
    .offset(parsedPagination.data.offset)
    .limit(parsedPagination.data.limit + 1);

  const hasMore = tweets.length > parsedPagination.data.limit;
  const data = hasMore ? tweets.slice(0, -1) : tweets;

  return c.json({
    message: 'Tweets fetched successfully',
    data: { tweets: data, hasMore, nextOffset: parsedPagination.data.offset + data.length },
  });
});
