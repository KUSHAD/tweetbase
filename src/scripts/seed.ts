import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import {
  saasAccounts,
  saasFollows,
  saasRetweets,
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
const REPLY_PROBABILITY = 0.2;

async function seed() {
  console.log('🧼 Clearing old data...');
  await db.delete(saasTweetLikes);
  await db.delete(saasTweetComments);
  await db.delete(saasRetweets);
  await db.delete(saasTweets);
  await db.delete(saasFollows);
  await db.delete(saasUsers);
  await db.delete(saasAccounts);

  console.log('🌱 Seeding database...');

  const passwordHash = await bcrypt.hash('12345678', 10);

  const accounts = [];
  const users = [];

  for (let i = 0; i < TOTAL_USERS; i++) {
    const accountId = createId();
    const userId = createId();

    accounts.push({
      id: accountId,
      email: faker.internet.email(),
      emailVerified: true,
      passwordHash,
    });

    users.push({
      id: userId,
      displayName: faker.person.fullName(),
      userName: faker.internet.userName().toLowerCase().slice(0, 15),
      avatarUrl: faker.image.avatar(),
      bio: faker.lorem.sentence(5),
      website: faker.internet.url(),
      accountId,
      followerCount: 0,
      followingCount: 0,
    });
  }

  await db.insert(saasAccounts).values(accounts);
  await db.insert(saasUsers).values(users);
  console.log('👥 Users and accounts created');

  // 👥 Follow relationships
  const follows = [];
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
          .set({ followerCount: user.followerCount, followingCount: user.followingCount })
          .where(eq(saasUsers.id, user.id)),
      ),
    );
  }

  console.log(`🔗 ${follows.length} follows created`);

  // 🐦 Tweets
  const tweets = [];
  for (const user of users) {
    for (let i = 0; i < TWEETS_PER_USER; i++) {
      const isMedia = Math.random() < 0.4;
      const mediaType: 'image' | 'video' | null = isMedia
        ? Math.random() < 0.5
          ? 'image'
          : 'video'
        : null;

      const mediaUrl = isMedia
        ? faker.image.urlLoremFlickr({ category: mediaType === 'image' ? 'cats' : 'nature' })
        : null;

      tweets.push({
        id: createId(),
        userId: user.id,
        content: faker.lorem.sentence(),
        mediaUrl,
        mediaType,
        likeCount: 0,
        retweetCount: 0,
        quoteCount: 0,
        commentCount: 0,
      });
    }
  }

  await db.insert(saasTweets).values(tweets);
  console.log(`📝 ${tweets.length} tweets created`);

  // 🔁 Retweets, 🗣️ Quotes, ❤️ Likes, 💬 Comments
  const likes = [];
  const retweets = [];
  const comments = [];
  const quoteTweets = []; // Fixed: Separate array for quote tweets

  for (const tweet of tweets) {
    for (const user of users) {
      // Skip interactions with own tweets for some operations
      if (tweet.userId === user.id) continue;

      // ❤️ Like
      if (Math.random() < LIKE_PROBABILITY) {
        likes.push({ userId: user.id, tweetId: tweet.id });
        tweet.likeCount++;
      }

      // 🔁 Retweet
      if (Math.random() < RETWEET_PROBABILITY) {
        retweets.push({ userId: user.id, tweetId: tweet.id });
        tweet.retweetCount++;
      }

      // 🗣️ Quote
      if (Math.random() < QUOTE_PROBABILITY) {
        quoteTweets.push({
          id: createId(),
          userId: user.id,
          content: faker.lorem.sentence(),
          quotedTweetId: tweet.id,
          mediaUrl: null,
          mediaType: null,
          likeCount: 0,
          retweetCount: 0,
          quoteCount: 0,
          commentCount: 0,
        });
        tweet.quoteCount++;
      }

      // 💬 Comments
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

  // Insert quote tweets separately
  if (quoteTweets.length) {
    await db.insert(saasTweets).values(quoteTweets);
    console.log(`🗣️ ${quoteTweets.length} quote tweets created`);
  }

  if (likes.length) await db.insert(saasTweetLikes).values(likes);
  if (retweets.length) await db.insert(saasRetweets).values(retweets);
  if (comments.length) await db.insert(saasTweetComments).values(comments);

  // Update tweet counts for original tweets
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
  console.log(`🗨️ ${comments.length} comments`);
  console.log('✅ Seeding complete!');
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
