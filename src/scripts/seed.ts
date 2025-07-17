import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import {
  saasAccounts,
  saasFollows,
  saasTweetComments,
  saasTweetLikes,
  saasTweets,
  saasUsers,
} from '../db/schema';

const TOTAL_USERS = 20;
const TWEETS_PER_USER = 5;
const FOLLOW_PROBABILITY = 0.3;
const RETWEET_PROBABILITY = 0.2;
const QUOTE_PROBABILITY = 0.1;
const LIKE_PROBABILITY = 0.4;
const COMMENT_PROBABILITY = 0.4;

async function seed(): Promise<void> {
  console.log('🧼 Clearing old data...');
  await db.delete(saasTweetLikes);
  await db.delete(saasTweetComments);
  await db.delete(saasTweets);
  await db.delete(saasFollows);
  await db.delete(saasUsers);
  await db.delete(saasAccounts);

  console.log('🌱 Seeding database...');
  const passwordHash = await bcrypt.hash('12345678', 10);

  const users: {
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

  await db.insert(saasAccounts).values(
    users.map(({ accountId }) => ({
      id: accountId,
      email: faker.internet.email(),
      emailVerified: true,
      passwordHash,
    })),
  );

  await db.insert(saasUsers).values(users);
  console.log('👥 Users and accounts created');

  const follows: { followerId: string; followingId: string }[] = [];
  for (const follower of users) {
    for (const following of users) {
      if (follower.id !== following.id && Math.random() < FOLLOW_PROBABILITY) {
        follows.push({
          followerId: follower.id,
          followingId: following.id,
        });
        follower.followingCount++;
        following.followerCount++;
      }
    }
  }

  if (follows.length) {
    await db.insert(saasFollows).values(follows);
    await Promise.all(
      users.map((user) =>
        db
          .update(saasUsers)
          .set({
            followerCount: user.followerCount,
            followingCount: user.followingCount,
          })
          .where(eq(saasUsers.id, user.id)),
      ),
    );
  }

  console.log(`🔗 ${follows.length} follows created`);

  const tweets: any[] = [];
  const likes: { userId: string; tweetId: string }[] = [];
  const quoteTweets: any[] = [];
  const retweets: any[] = [];
  const comments: { id: string; userId: string; tweetId: string; content: string }[] = [];

  for (const user of users) {
    for (let i = 0; i < TWEETS_PER_USER; i++) {
      tweets.push({
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

  await db.insert(saasTweets).values(tweets);
  console.log(`📝 ${tweets.length} tweets created`);

  for (const tweet of tweets) {
    for (const user of users) {
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

  if (retweets.length) await db.insert(saasTweets).values(retweets);
  if (quoteTweets.length) await db.insert(saasTweets).values(quoteTweets);
  if (likes.length) await db.insert(saasTweetLikes).values(likes);
  if (comments.length) await db.insert(saasTweetComments).values(comments);

  await Promise.all(
    tweets.map((tweet) =>
      db
        .update(saasTweets)
        .set({
          likeCount: tweet.likeCount,
          retweetCount: tweet.retweetCount,
          quoteCount: tweet.quoteCount,
          commentCount: tweet.commentCount,
        })
        .where(eq(saasTweets.id, tweet.id)),
    ),
  );

  console.log(`❤️ ${likes.length} likes`);
  console.log(`🔁 ${retweets.length} retweets`);
  console.log(`🗣️ ${quoteTweets.length} quotes`);
  console.log(`💬 ${comments.length} comments`);

  await Promise.all(
    users.map((user) => {
      const tweetCount = [...tweets, ...retweets, ...quoteTweets].filter(
        (t) => t.userId === user.id,
      ).length;
      return db.update(saasUsers).set({ tweetCount }).where(eq(saasUsers.id, user.id));
    }),
  );

  console.log('📊 tweetCount updated for all users');
  console.log('✅ Seeding complete!');
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
