import { createId } from '@paralleldrive/cuid2';
import { sql } from 'drizzle-orm';
import {
  AnyPgColumn,
  boolean,
  index,
  integer,
  pgEnum,
  pgTableCreator,
  primaryKey,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

const pgTable = pgTableCreator((name) => `standalone_${name}`);

export const standaloneVerificationTokenType = pgEnum('standalone_verification_token_type', [
  'EMAIL_VERIFICATION',
  'PASSWORD_RESET',
]);

export const standaloneTweetType = pgEnum('standalone_tweet_type', ['TWEET', 'RETWEET', 'QUOTE']);

export const standaloneAccounts = pgTable('accounts', {
  id: text('id')
    .$defaultFn(() => createId())
    .primaryKey(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const standaloneSessions = pgTable('sessions', {
  id: text('id')
    .$defaultFn(() => createId())
    .primaryKey(),
  accountId: text('account_id')
    .notNull()
    .references(() => standaloneAccounts.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => standaloneUsers.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  refreshToken: text('refresh_token').notNull().unique(),
  userAgent: text('user_agent'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
});

export const standaloneVerificationTokens = pgTable('verification_tokens', {
  id: text('id')
    .$defaultFn(() => createId())
    .primaryKey(),
  accountId: text('account_id')
    .notNull()
    .references(() => standaloneAccounts.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => standaloneUsers.id, { onDelete: 'cascade' }),
  token: text('token').notNull(),
  tokenType: standaloneVerificationTokenType('token_type').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
});

export const standaloneUsers = pgTable(
  'users',
  {
    id: text('id')
      .$defaultFn(() => createId())
      .primaryKey(),
    displayName: varchar('display_name', { length: 50 }).notNull(),
    userName: varchar('user_name', { length: 15 }).notNull().unique(),
    avatarUrl: text('avatar_url')
      .notNull()
      .default('https://ozzfzo6f4u.ufs.sh/f/4E4gJXn0fX5QxhdfWFjG1B5cSivUhkuwMOLA4yI3CmFbWTNE'),
    bio: varchar('bio', { length: 100 }).default(''),
    website: varchar('website', { length: 100 }).default(''),
    tweetCount: integer('tweet_count').notNull().default(0),
    followerCount: integer('follower_count').notNull().default(0),
    followingCount: integer('following_count').notNull().default(0),
    accountId: text('account_id')
      .references(() => standaloneAccounts.id, { onDelete: 'cascade', onUpdate: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('standalone_users_search_index').using(
      'gin',
      sql`to_tsvector('english', ${table.userName} || ' ' || ${table.displayName})`,
    ),
  ],
);

export const standaloneFollows = pgTable(
  'follows',
  {
    followerId: text('follower_id')
      .references(() => standaloneUsers.id, { onDelete: 'cascade', onUpdate: 'cascade' })
      .notNull(),
    followingId: text('following_id')
      .references(() => standaloneUsers.id, { onDelete: 'cascade', onUpdate: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.followerId, table.followingId],
    }),
    index('standalone_follows_follower_idx').on(table.followerId),
    index('standalone_follows_following_idx').on(table.followingId),
  ],
);

export const standaloneTweets = pgTable(
  'tweets',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text('user_id')
      .notNull()
      .references(() => standaloneUsers.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    content: varchar('content', { length: 280 }),
    mediaUrl: text('media_url'),
    type: standaloneTweetType('type').default('TWEET').notNull(),
    originalTweetId: text('original_tweet_id').references((): AnyPgColumn => standaloneTweets.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    likeCount: integer('like_count').notNull().default(0),
    retweetCount: integer('retweet_count').notNull().default(0),
    quoteCount: integer('quote_count').notNull().default(0),
    commentCount: integer('comment_count').notNull().default(0),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('standalone_tweets_user_idx').on(table.userId),
    index('standalone_tweets_type_idx').on(table.type),
    index('standalone_tweets_original_idx').on(table.originalTweetId),
  ],
);

export const standaloneTweetComments = pgTable(
  'tweet_comments',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    userId: text('user_id')
      .notNull()
      .references(() => standaloneUsers.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    tweetId: text('tweet_id')
      .notNull()
      .references(() => standaloneTweets.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    content: varchar('content', { length: 150 }).notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .$onUpdate(() => new Date())
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('standalone_tweet_comments_tweet_idx').on(table.tweetId),
    index('standalone_tweet_comments_user_idx').on(table.userId),
  ],
);

export const standaloneTweetLikes = pgTable(
  'tweet_likes',
  {
    userId: text('user_id')
      .notNull()
      .references(() => standaloneUsers.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    tweetId: text('tweet_id')
      .notNull()
      .references(() => standaloneTweets.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.tweetId] }),
    index('standalone_tweet_likes_user_idx').on(table.userId),
    index('standalone_tweet_likes_tweet_idx').on(table.tweetId),
  ],
);
