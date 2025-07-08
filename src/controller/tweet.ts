import { zValidator } from '@hono/zod-validator';
import { and, eq, sql } from 'drizzle-orm';
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

    if (!tweet) {
      return c.json({ message: 'Tweet not found with the associated user' }, 400);
    }

    // 🧹 Clean up media
    if (tweet.mediaUrl) {
      const fileKey = getUploadthingFileKey(tweet.mediaUrl);
      await utapi.deleteFiles(fileKey);
    }

    // ⬇️ Optional: Decrement parent tweet counters if this is a quote or retweet
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

    return c.json({
      message: 'Tweet Deleted!',
      data: { tweetId },
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

    if (!tweetId) {
      return c.json({ message: 'Missing tweetId in route params' }, 400);
    }

    const [tweet] = await db
      .select({
        id: saasTweets.id,
        mediaUrl: saasTweets.mediaUrl,
        type: saasTweets.type,
      })
      .from(saasTweets)
      .where(and(eq(saasTweets.id, tweetId), eq(saasTweets.userId, authUser.userId)))
      .limit(1);

    if (!tweet) {
      return c.json({ message: 'Tweet not found with the associated user' }, 400);
    }

    // 💬 Rules per type
    if (tweet.type === 'RETWEET' && (content || media)) {
      return c.json({ message: 'Retweets cannot have content or media' }, 400);
    }

    if (tweet.type === 'QUOTE' && media) {
      return c.json({ message: 'Quoted tweets cannot have media' }, 400);
    }

    if (!content && !media) {
      return c.json({ message: 'Tweet must have content or media' }, 400);
    }

    // 📤 Upload new media if present
    let newMediaUrl: string | null = null;
    if (media) {
      const upload = await utapi.uploadFiles(media);
      if (!upload?.data?.ufsUrl) {
        return c.json({ message: 'Media upload failed' }, 500);
      }
      newMediaUrl = upload.data.ufsUrl;
    }

    // 🧹 Remove old media if replaced
    if (tweet.mediaUrl && newMediaUrl) {
      const prevKey = getUploadthingFileKey(tweet.mediaUrl);
      await utapi.deleteFiles(prevKey);
    }

    // 🔁 Update
    const [updatedTweet] = await db
      .update(saasTweets)
      .set({
        content,
        mediaUrl: newMediaUrl ?? (media ? null : tweet.mediaUrl),
      })
      .where(and(eq(saasTweets.id, tweetId), eq(saasTweets.userId, authUser.userId)))
      .returning();

    // 👤 Fetch user again (lightweight)
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
