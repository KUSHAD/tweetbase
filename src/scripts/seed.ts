import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { accounts, follows, tweetComments, tweetLikes, tweets, users } from '../db/schema';

const TOTAL_USERS = 20;
const TWEETS_PER_USER = 5;
const FOLLOW_PROBABILITY = 0.3;
const RETWEET_PROBABILITY = 0.2;
const QUOTE_PROBABILITY = 0.1;
const LIKE_PROBABILITY = 0.4;
const COMMENT_PROBABILITY = 0.4;

async function seed(): Promise<void> {
  console.log('🧼 Clearing old data...');
  await db.delete(tweetLikes);
  await db.delete(tweetComments);
  await db.delete(tweets);
  await db.delete(follows);
  await db.delete(users);
  await db.delete(accounts);

  console.log('🌱 Seeding database...');
  const passwordHash = await bcrypt.hash('12345678', 10);

  const appUsers: {
    id: string;
    accountId: string;
    displayName: string;
    userName: string;
    avatarUrl: string;
    bio: string;
    website: string;
    followerCount: number;
    followingCount: number;
  }[] = Array.from({ length: TOTAL_USERS }).map(() => {
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
    };
  });

  await db.insert(accounts).values(
    appUsers.map(({ accountId }) => ({
      id: accountId,
      email: faker.internet.email(),
      emailVerified: true,
      passwordHash,
    })),
  );

  await db.insert(users).values(appUsers);
  console.log('👥 Users and accounts created');

  const appFollows: { followerId: string; followingId: string }[] = [];
  for (const follower of appUsers) {
    for (const following of appUsers) {
      if (follower.id !== following.id && Math.random() < FOLLOW_PROBABILITY) {
        appFollows.push({
          followerId: follower.id,
          followingId: following.id,
        });
        follower.followingCount++;
        following.followerCount++;
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

  const appTweets: any[] = [];
  const likes: { userId: string; tweetId: string }[] = [];
  const quoteTweets: any[] = [];
  const retweets: any[] = [];
  const comments: { id: string; userId: string; tweetId: string; content: string }[] = [];

  for (const user of appUsers) {
    for (let i = 0; i < TWEETS_PER_USER; i++) {
      appTweets.push({
        id: createId(),
        userId: user.id,
        type: 'TWEET',
        content: faker.lorem.sentence(),
        mediaUrl: Math.random() < 0.4 ? faker.image.urlPicsumPhotos() : null,
        originalTweetId: null,
        likeCount: 0,
        retweetCount: 0,
        quoteCount: 0,
        commentCount: 0,
      });
    }
  }

  await db.insert(tweets).values(appTweets);
  console.log(`📝 ${appTweets.length} tweets created`);

  for (const tweet of appTweets) {
    for (const user of appUsers) {
      if (user.id === tweet.userId) continue;

      if (Math.random() < LIKE_PROBABILITY) {
        likes.push({ userId: user.id, tweetId: tweet.id });
        tweet.likeCount++;
      }

      if (Math.random() < RETWEET_PROBABILITY) {
        retweets.push({
          id: createId(),
          userId: user.id,
          type: 'RETWEET',
          content: null,
          mediaUrl: null,
          originalTweetId: tweet.id,
          likeCount: 0,
          retweetCount: 0,
          quoteCount: 0,
          commentCount: 0,
        });
        tweet.retweetCount++;
      }

      if (Math.random() < QUOTE_PROBABILITY) {
        quoteTweets.push({
          id: createId(),
          userId: user.id,
          type: 'QUOTE',
          content: faker.lorem.sentence(),
          mediaUrl: null,
          originalTweetId: tweet.id,
          likeCount: 0,
          retweetCount: 0,
          quoteCount: 0,
          commentCount: 0,
        });
        tweet.quoteCount++;
      }

      if (Math.random() < COMMENT_PROBABILITY) {
        comments.push({
          id: createId(),
          userId: user.id,
          tweetId: tweet.id,
          content: faker.lorem.sentence(),
        });
        tweet.commentCount++;
      }
    }
  }

  if (retweets.length) await db.insert(tweets).values(retweets);
  if (quoteTweets.length) await db.insert(tweets).values(quoteTweets);
  if (likes.length) await db.insert(tweetLikes).values(likes);
  if (comments.length) await db.insert(tweetComments).values(comments);

  await Promise.all(
    appTweets.map((tweet) =>
      db
        .update(tweets)
        .set({
          likeCount: tweet.likeCount,
          retweetCount: tweet.retweetCount,
          quoteCount: tweet.quoteCount,
          commentCount: tweet.commentCount,
        })
        .where(eq(tweets.id, tweet.id)),
    ),
  );

  console.log(`❤️ ${likes.length} likes`);
  console.log(`🔁 ${retweets.length} retweets`);
  console.log(`🗣️ ${quoteTweets.length} quotes`);
  console.log(`💬 ${comments.length} comments`);

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
