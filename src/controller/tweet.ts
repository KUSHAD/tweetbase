import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db';
import { standaloneTweets, standaloneUsers } from '../db/schema';
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
    .insert(standaloneTweets)
    .values({
      userId: authUser.userId,
      content,
      mediaUrl: uploadedMedia?.data?.ufsUrl ?? null,
      type: 'TWEET',
    })
    .returning();

  const [updatedUser] = await db
    .update(standaloneUsers)
    .set({ tweetCount: sql`${standaloneUsers.tweetCount} + 1` })
    .where(eq(standaloneUsers.id, authUser.userId))
    .returning({
      id: standaloneUsers.id,
      displayName: standaloneUsers.displayName,
      userName: standaloneUsers.userName,
      tweetCount: standaloneUsers.tweetCount,
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
      id: standaloneTweets.id,
      content: standaloneTweets.content,
      mediaUrl: standaloneTweets.mediaUrl,
      type: standaloneTweets.type,
      likeCount: standaloneTweets.likeCount,
      commentCount: standaloneTweets.commentCount,
      quoteCount: standaloneTweets.quoteCount,
      retweetCount: standaloneTweets.retweetCount,
      createdAt: standaloneTweets.createdAt,
      updatedAt: standaloneTweets.updatedAt,
      user: {
        id: standaloneUsers.id,
        displayName: standaloneUsers.displayName,
        userName: standaloneUsers.userName,
        avatarUrl: standaloneUsers.avatarUrl,
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
    .from(standaloneTweets)
    .innerJoin(standaloneUsers, eq(standaloneTweets.userId, standaloneUsers.id))
    .leftJoin(originalTweet, eq(standaloneTweets.originalTweetId, originalTweet.id))
    .leftJoin(originalTweetUser, eq(originalTweet.userId, originalTweetUser.id))
    .where(eq(standaloneTweets.id, tweetId))
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
      id: standaloneTweets.id,
      userId: standaloneTweets.userId,
      mediaUrl: standaloneTweets.mediaUrl,
      originalTweetId: standaloneTweets.originalTweetId,
      type: standaloneTweets.type,
    })
    .from(standaloneTweets)
    .where(and(eq(standaloneTweets.id, tweetId), eq(standaloneTweets.userId, authUser.userId)))
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
        ? standaloneTweets.retweetCount
        : tweet.type === 'QUOTE'
          ? standaloneTweets.quoteCount
          : null;

    if (field) {
      await db
        .update(standaloneTweets)
        .set({ [field.name]: sql`${field} - 1` })
        .where(eq(standaloneTweets.id, tweet.originalTweetId));
    }
  }

  await db.delete(standaloneTweets).where(eq(standaloneTweets.id, tweetId));

  await db
    .update(standaloneUsers)
    .set({ tweetCount: sql`${standaloneUsers.tweetCount} - 1` })
    .where(eq(standaloneUsers.id, authUser.userId));

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
      id: standaloneTweets.id,
      mediaUrl: standaloneTweets.mediaUrl,
      type: standaloneTweets.type,
    })
    .from(standaloneTweets)
    .where(
      and(
        eq(standaloneTweets.id, parsed.data.tweetId),
        eq(standaloneTweets.userId, authUser.userId),
      ),
    )
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
    .update(standaloneTweets)
    .set({
      content,
      mediaUrl: newMediaUrl ?? (media ? null : tweet.mediaUrl),
    })
    .where(
      and(
        eq(standaloneTweets.id, parsed.data.tweetId),
        eq(standaloneTweets.userId, authUser.userId),
      ),
    )
    .returning();

  const [user] = await db
    .select({
      id: standaloneUsers.id,
      displayName: standaloneUsers.displayName,
      userName: standaloneUsers.userName,
    })
    .from(standaloneUsers)
    .where(
      and(
        eq(standaloneUsers.id, authUser.userId),
        eq(standaloneUsers.accountId, authUser.accountId),
      ),
    )
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
      id: standaloneTweets.id,
      userId: standaloneTweets.userId,
      content: standaloneTweets.content,
      mediaUrl: standaloneTweets.mediaUrl,
      retweetCount: standaloneTweets.retweetCount,
      createdAt: standaloneTweets.createdAt,
      user: {
        id: standaloneUsers.id,
        displayName: standaloneUsers.displayName,
        userName: standaloneUsers.userName,
        avatarUrl: standaloneUsers.avatarUrl,
      },
    })
    .from(standaloneTweets)
    .where(eq(standaloneTweets.id, tweetId))
    .innerJoin(standaloneUsers, eq(standaloneUsers.id, standaloneTweets.userId))
    .limit(1);

  if (!ogTweet)
    throw new HTTPException(404, { message: 'Original tweet not found', cause: tweetId });

  if (ogTweet.userId === authUser.userId)
    throw new HTTPException(400, {
      message: 'Cannot retweet your own tweet',
      cause: 'Self-retweet',
    });

  const [alreadyRetweeted] = await db
    .select({ id: standaloneTweets.id })
    .from(standaloneTweets)
    .where(
      and(
        eq(standaloneTweets.userId, authUser.userId),
        eq(standaloneTweets.originalTweetId, tweetId),
        eq(standaloneTweets.type, 'RETWEET'),
      ),
    );

  if (alreadyRetweeted)
    throw new HTTPException(400, { message: 'Already retweeted', cause: 'Duplicate retweet' });

  const [retweet] = await db
    .insert(standaloneTweets)
    .values({
      userId: authUser.userId,
      type: 'RETWEET',
      originalTweetId: tweetId,
    })
    .returning();

  await db
    .update(standaloneTweets)
    .set({ retweetCount: sql`${standaloneTweets.retweetCount} + 1` })
    .where(eq(standaloneTweets.id, tweetId));

  await db
    .update(standaloneUsers)
    .set({ tweetCount: sql`${standaloneUsers.tweetCount} + 1` })
    .where(eq(standaloneUsers.id, authUser.userId));

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
        id: standaloneTweets.id,
        content: standaloneTweets.content,
        mediaUrl: standaloneTweets.mediaUrl,
        createdAt: standaloneTweets.createdAt,
        user: {
          id: standaloneUsers.id,
          displayName: standaloneUsers.displayName,
          userName: standaloneUsers.userName,
          avatarUrl: standaloneUsers.avatarUrl,
        },
      })
      .from(standaloneTweets)
      .innerJoin(standaloneUsers, eq(standaloneUsers.id, standaloneTweets.userId))
      .where(eq(standaloneTweets.id, safeId.data.tweetId))
      .limit(1);

    if (!ogTweet)
      throw new HTTPException(404, { message: 'Original tweet not found', cause: tweetId });

    const [newQuote] = await db
      .insert(standaloneTweets)
      .values({
        userId: authUser.userId,
        content,
        type: 'QUOTE',
        originalTweetId: ogTweet.id,
      })
      .returning();

    await db
      .update(standaloneTweets)
      .set({ quoteCount: sql`${standaloneTweets.quoteCount} + 1` })
      .where(eq(standaloneTweets.id, ogTweet.id));

    const [updatedUser] = await db
      .update(standaloneUsers)
      .set({ tweetCount: sql`${standaloneUsers.tweetCount} + 1` })
      .where(eq(standaloneUsers.id, authUser.userId))
      .returning({
        id: standaloneUsers.id,
        displayName: standaloneUsers.displayName,
        userName: standaloneUsers.userName,
        tweetCount: standaloneUsers.tweetCount,
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
      id: standaloneTweets.id,
      content: standaloneTweets.content,
      mediaUrl: standaloneTweets.mediaUrl,
      type: standaloneTweets.type,
      likeCount: standaloneTweets.likeCount,
      commentCount: standaloneTweets.commentCount,
      quoteCount: standaloneTweets.quoteCount,
      retweetCount: standaloneTweets.retweetCount,
      createdAt: standaloneTweets.createdAt,
      updatedAt: standaloneTweets.updatedAt,
      user: {
        id: standaloneUsers.id,
        displayName: standaloneUsers.displayName,
        userName: standaloneUsers.userName,
        avatarUrl: standaloneUsers.avatarUrl,
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
    .from(standaloneTweets)
    .innerJoin(standaloneUsers, eq(standaloneTweets.userId, standaloneUsers.id))
    .leftJoin(originalTweet, eq(standaloneTweets.originalTweetId, originalTweet.id))
    .leftJoin(originalTweetUser, eq(originalTweet.userId, originalTweetUser.id))
    .where(eq(standaloneTweets.userId, userId))
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
