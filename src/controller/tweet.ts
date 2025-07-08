import { zValidator } from '@hono/zod-validator';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { saasTweets, saasUsers } from '../db/schema';
import { originalTweet, originalTweetUser } from '../lib/db-alias';
import { utapi } from '../lib/uploadthing';
import { errorFormat, getUploadthingFileKey } from '../lib/utils';
import { getTweetSchema, newTweetSchema } from '../validators/tweet';

export const newTweet = zValidator('form', newTweetSchema, async (res, c) => {
  if (!res.success) return c.json(errorFormat(res.error), 400);

  try {
    const { content, media } = res.data;

    const authUser = c.get('authUser');

    let uploadedMedia = null;
    if (media) {
      uploadedMedia = await utapi.uploadFiles(media);
    }

    const [newTweet] = await db
      .insert(saasTweets)
      .values({
        userId: authUser.userId,
        content,
        mediaUrl: uploadedMedia?.data?.ufsUrl ?? null,
        type: 'TWEET',
      })
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
      message: 'Tweeted!',
      data: {
        tweet: {
          ...newTweet,
          user,
        },
      },
    });
  } catch (error) {
    return c.json(errorFormat(error), 500);
  }
});

export const getTweet = zValidator('param', getTweetSchema, async (res, c) => {
  if (!res.success) return c.json(errorFormat(res.error), 400);
  try {
    const { tweetId } = res.data;

    const [tweet] = await db
      .select({
        // Tweet fields
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
        originalUser: {
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

    if (!tweet) return c.json({ message: 'No tweet found' }, 404);

    return c.json({
      message: 'Tweet fetched!',
      data: {
        tweet,
      },
    });
  } catch (error) {
    return c.json(errorFormat(error), 500);
  }
});

export const deleteTweet = zValidator('param', getTweetSchema, async (res, c) => {
  if (!res.success) return c.json(errorFormat(res.error), 400);
  try {
    const authUser = c.get('authUser');
    const { tweetId } = res.data;

    const [deleted] = await db
      .delete(saasTweets)
      .where(and(eq(saasTweets.userId, authUser.userId), eq(saasTweets.id, tweetId)))
      .returning({ id: saasTweets.id });

    if (!deleted) return c.json({ message: 'Tweet not found with the associated user' }, 400);

    return c.json({
      message: 'Tweet Deleted!',
      data: {
        tweetId: deleted.id,
      },
    });
  } catch (error) {
    return c.json(errorFormat(error), 500);
  }
});

export const editTweet = zValidator('form', newTweetSchema, async (res, c) => {
  if (!res.success) return c.json(errorFormat(res.error), 400);
  try {
    const tweetId = c.req.param('tweetId');
    const authUser = c.get('authUser');
    const { content, media } = res.data;

    let uploadedMedia = null;
    if (media) {
      uploadedMedia = await utapi.uploadFiles(media);
    }

    const [foundTweet] = await db
      .select({
        id: saasTweets.id,
        mediaUrl: saasTweets.mediaUrl,
      })
      .from(saasTweets)
      .where(and(eq(saasTweets.id, tweetId!), eq(saasTweets.userId, authUser.userId)))
      .limit(1);

    if (!foundTweet) return c.json({ message: 'Tweet not found with the associated user' }, 400);

    if (foundTweet.mediaUrl) {
      const prevFileKey = getUploadthingFileKey(foundTweet.mediaUrl);
      await utapi.deleteFiles(prevFileKey);
    }

    const [updatedTweet] = await db
      .update(saasTweets)
      .set({
        content,
        mediaUrl: uploadedMedia?.data?.ufsUrl ?? null,
      })
      .where(and(eq(saasTweets.id, tweetId!), eq(saasTweets.userId, authUser.userId)))
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
      message: 'Tweet Updated!',
      data: {
        tweet: {
          ...updatedTweet,
          user,
        },
      },
    });
  } catch (error) {
    return c.json(errorFormat(error), 500);
  }
});
