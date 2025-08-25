import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import {
  accounts,
  follows,
  notifications,
  tweetBookmarks,
  tweetComments,
  tweetLikes,
  tweets,
  users,
} from '../db/schema';

// --- CONFIG ---
const CONFIG = {
  TOTAL_USERS: 20,
  TWEETS_PER_USER: 5,
  PROBABILITIES: {
    FOLLOW: 0.3,
    RETWEET: 0.2,
    QUOTE: 0.1,
    LIKE: 0.4,
    COMMENT: 0.4,
    BOOKMARK: 0.2,
  },
  PASSWORD: '12345678',
  NOTIFICATIONS: {
    ENABLE: true,
    READ_PROBABILITY: 0.5,
  },
  MEDIA: {
    ENABLE: true,
    PROBABILITY: 0.4,
  },
  TIME: {
    RANGE_DAYS: 30, // events spread over last 30 days
    SKEW_RECENT: true, // true = more recent timestamps (realistic usage)
  },
};

// --- UTIL: random timestamp in last N days ---
function randomDateInRange(): Date {
  const now = Date.now();
  const past = now - CONFIG.TIME.RANGE_DAYS * 24 * 60 * 60 * 1000;

  if (CONFIG.TIME.SKEW_RECENT) {
    // skew toward recent (quadratic bias)
    const r = Math.random();
    const skewed = r * r; // more weight near 0
    return new Date(past + skewed * (now - past));
  }

  // uniform distribution
  return new Date(past + Math.random() * (now - past));
}

async function seed(): Promise<void> {
  console.log('🧼 Clearing old data...');
  await db.delete(notifications);
  await db.delete(tweetLikes);
  await db.delete(tweetComments);
  await db.delete(tweetBookmarks);
  await db.delete(tweets);
  await db.delete(follows);
  await db.delete(users);
  await db.delete(accounts);

  console.log('🌱 Seeding database...');
  const passwordHash = await bcrypt.hash(CONFIG.PASSWORD, 10);

  // --- USERS ---
  const appUsers = Array.from({ length: CONFIG.TOTAL_USERS }).map(() => {
    const accountId = createId();
    const id = createId();
    return {
      id,
      accountId,
      displayName: faker.person.fullName(),
      userName: faker.internet.userName().toLowerCase().slice(0, 15),
      avatarUrl: faker.image.avatarGitHub(),
      bio: faker.lorem.sentence(5),
      website: faker.internet.url(),
      followerCount: 0,
      followingCount: 0,
      createdAt: randomDateInRange(),
    };
  });

  await db.insert(accounts).values(
    appUsers.map(({ accountId, createdAt }) => ({
      id: accountId,
      email: faker.internet.email(),
      emailVerified: true,
      passwordHash,
      createdAt,
    })),
  );
  await db.insert(users).values(appUsers);
  console.log('👥 Users and accounts created');

  // --- FOLLOWS ---
  const appFollows: { followerId: string; followingId: string; createdAt: Date }[] = [];
  const followNotifs: any[] = [];

  for (const follower of appUsers) {
    for (const following of appUsers) {
      if (follower.id !== following.id && Math.random() < CONFIG.PROBABILITIES.FOLLOW) {
        const ts = randomDateInRange();
        appFollows.push({
          followerId: follower.id,
          followingId: following.id,
          createdAt: ts,
        });
        follower.followingCount++;
        following.followerCount++;

        if (CONFIG.NOTIFICATIONS.ENABLE) {
          followNotifs.push({
            id: createId(),
            recipientId: following.id,
            actorId: follower.id,
            type: 'FOLLOW',
            tweetId: null,
            commentId: null,
            isRead: Math.random() < CONFIG.NOTIFICATIONS.READ_PROBABILITY,
            createdAt: ts,
          });
        }
      }
    }
  }

  if (appFollows.length) {
    await db.insert(follows).values(appFollows);
    await Promise.all(
      appUsers.map((user) =>
        db
          .update(users)
          .set({
            followerCount: user.followerCount,
            followingCount: user.followingCount,
          })
          .where(eq(users.id, user.id)),
      ),
    );
  }
  console.log(`🔗 ${appFollows.length} follows created`);

  // --- TWEETS ---
  const appTweets: any[] = [];
  const likes: { userId: string; tweetId: string; createdAt: Date }[] = [];
  const bookmarks: { userId: string; tweetId: string; createdAt: Date }[] = [];
  const quoteTweets: any[] = [];
  const retweets: any[] = [];
  const comments: {
    id: string;
    userId: string;
    tweetId: string;
    content: string;
    createdAt: Date;
  }[] = [];
  const notifEvents: any[] = [];

  for (const user of appUsers) {
    for (let i = 0; i < CONFIG.TWEETS_PER_USER; i++) {
      appTweets.push({
        id: createId(),
        userId: user.id,
        type: 'TWEET',
        content: faker.lorem.sentence(),
        mediaUrl:
          CONFIG.MEDIA.ENABLE && Math.random() < CONFIG.MEDIA.PROBABILITY
            ? faker.image.urlPicsumPhotos()
            : null,
        originalTweetId: null,
        likeCount: 0,
        retweetCount: 0,
        quoteCount: 0,
        commentCount: 0,
        bookmarkCount: 0,
        createdAt: randomDateInRange(),
      });
    }
  }
  await db.insert(tweets).values(appTweets);
  console.log(`📝 ${appTweets.length} tweets created`);

  // --- INTERACTIONS ---
  for (const tweet of appTweets) {
    for (const user of appUsers) {
      if (user.id === tweet.userId) continue;

      // Likes
      if (Math.random() < CONFIG.PROBABILITIES.LIKE) {
        const ts = randomDateInRange();
        likes.push({ userId: user.id, tweetId: tweet.id, createdAt: ts });
        tweet.likeCount++;

        if (CONFIG.NOTIFICATIONS.ENABLE) {
          notifEvents.push({
            id: createId(),
            recipientId: tweet.userId,
            actorId: user.id,
            type: 'LIKE',
            tweetId: tweet.id,
            commentId: null,
            isRead: Math.random() < CONFIG.NOTIFICATIONS.READ_PROBABILITY,
            createdAt: ts,
          });
        }
      }

      // Bookmarks
      if (Math.random() < CONFIG.PROBABILITIES.BOOKMARK) {
        bookmarks.push({
          userId: user.id,
          tweetId: tweet.id,
          createdAt: randomDateInRange(),
        });
        tweet.bookmarkCount++;
      }

      // Retweets
      if (Math.random() < CONFIG.PROBABILITIES.RETWEET) {
        const ts = randomDateInRange();
        const retweetId = createId();
        retweets.push({
          id: retweetId,
          userId: user.id,
          type: 'RETWEET',
          content: null,
          mediaUrl: null,
          originalTweetId: tweet.id,
          likeCount: 0,
          retweetCount: 0,
          quoteCount: 0,
          commentCount: 0,
          bookmarkCount: 0,
          createdAt: ts,
        });
        tweet.retweetCount++;

        if (CONFIG.NOTIFICATIONS.ENABLE) {
          notifEvents.push({
            id: createId(),
            recipientId: tweet.userId,
            actorId: user.id,
            type: 'RETWEET',
            tweetId: tweet.id,
            commentId: null,
            isRead: Math.random() < CONFIG.NOTIFICATIONS.READ_PROBABILITY,
            createdAt: ts,
          });
        }
      }

      // Quotes
      if (Math.random() < CONFIG.PROBABILITIES.QUOTE) {
        const ts = randomDateInRange();
        const quoteId = createId();
        quoteTweets.push({
          id: quoteId,
          userId: user.id,
          type: 'QUOTE',
          content: faker.lorem.sentence(),
          mediaUrl: null,
          originalTweetId: tweet.id,
          likeCount: 0,
          retweetCount: 0,
          quoteCount: 0,
          commentCount: 0,
          bookmarkCount: 0,
          createdAt: ts,
        });
        tweet.quoteCount++;

        if (CONFIG.NOTIFICATIONS.ENABLE) {
          notifEvents.push({
            id: createId(),
            recipientId: tweet.userId,
            actorId: user.id,
            type: 'QUOTE',
            tweetId: tweet.id,
            commentId: null,
            isRead: Math.random() < CONFIG.NOTIFICATIONS.READ_PROBABILITY,
            createdAt: ts,
          });
        }
      }

      // Comments
      if (Math.random() < CONFIG.PROBABILITIES.COMMENT) {
        const ts = randomDateInRange();
        const commentId = createId();
        comments.push({
          id: commentId,
          userId: user.id,
          tweetId: tweet.id,
          content: faker.lorem.sentence(),
          createdAt: ts,
        });
        tweet.commentCount++;

        if (CONFIG.NOTIFICATIONS.ENABLE) {
          notifEvents.push({
            id: createId(),
            recipientId: tweet.userId,
            actorId: user.id,
            type: 'COMMENT',
            tweetId: tweet.id,
            commentId,
            isRead: Math.random() < CONFIG.NOTIFICATIONS.READ_PROBABILITY,
            createdAt: ts,
          });
        }
      }
    }
  }

  if (retweets.length) await db.insert(tweets).values(retweets);
  if (quoteTweets.length) await db.insert(tweets).values(quoteTweets);
  if (likes.length) await db.insert(tweetLikes).values(likes);
  if (bookmarks.length) await db.insert(tweetBookmarks).values(bookmarks);
  if (comments.length) await db.insert(tweetComments).values(comments);
  if (CONFIG.NOTIFICATIONS.ENABLE && (notifEvents.length || followNotifs.length))
    await db.insert(notifications).values([...notifEvents, ...followNotifs]);

  // Update counts
  await Promise.all(
    appTweets.map((tweet) =>
      db
        .update(tweets)
        .set({
          likeCount: tweet.likeCount,
          retweetCount: tweet.retweetCount,
          quoteCount: tweet.quoteCount,
          commentCount: tweet.commentCount,
          bookmarkCount: tweet.bookmarkCount,
        })
        .where(eq(tweets.id, tweet.id)),
    ),
  );

  console.log(`❤️ ${likes.length} likes`);
  console.log(`🔖 ${bookmarks.length} bookmarks`);
  console.log(`🔁 ${retweets.length} retweets`);
  console.log(`🗣️ ${quoteTweets.length} quotes`);
  console.log(`💬 ${comments.length} comments`);
  console.log(`🔔 ${notifEvents.length + followNotifs.length} notifications (spread over time)`);

  // Update tweetCount for users
  await Promise.all(
    appUsers.map((user) => {
      const tweetCount = [...appTweets, ...retweets, ...quoteTweets].filter(
        (t) => t.userId === user.id,
      ).length;
      return db.update(users).set({ tweetCount }).where(eq(users.id, user.id));
    }),
  );

  console.log('📊 tweetCount updated for all users');
  console.log('✅ Seeding complete!');
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
