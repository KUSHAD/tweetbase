import { createId } from '@paralleldrive/cuid2';
import { relations, sql } from 'drizzle-orm';
import {
  AnyPgColumn,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  point,
  primaryKey,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

export const verificationTokenType = pgEnum('verification_token_type', [
  'EMAIL_VERIFICATION',
  'PASSWORD_RESET',
]);

export const tweetType = pgEnum('tweet_type', ['TWEET', 'RETWEET', 'QUOTE']);

export const notificationType = pgEnum('notification_type', [
  'LIKE',
  'COMMENT',
  'RETWEET',
  'QUOTE',
  'FOLLOW',
]);

export const accounts = pgTable('accounts', {
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

export const sessions = pgTable('sessions', {
  id: text('id')
    .$defaultFn(() => createId())
    .primaryKey(),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  refreshToken: text('refresh_token').notNull().unique(),
  userAgent: text('user_agent'),
  ipAddress: text('ip_address'),
  city: text('city'),
  country: text('country'),
  location: point('location', {
    mode: 'xy',
  }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable('verification_tokens', {
  id: text('id')
    .$defaultFn(() => createId())
    .primaryKey(),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull(),
  tokenType: verificationTokenType('token_type').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
});

export const users = pgTable(
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
      .references(() => accounts.id, { onDelete: 'cascade', onUpdate: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('users_search_index').using(
      'gin',
      sql`to_tsvector('english', ${table.userName} || ' ' || ${table.displayName})`,
    ),
  ],
);

export const userSubscriptions = pgTable(
  'user_subscriptions',
  {
    id: text('id')
      .$defaultFn(() => createId())
      .primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    stripeCustomerId: text('stripe_customer_id').notNull(),
    stripeSubscriptionId: text('stripe_subscription_id').notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    currentPeriodStart: timestamp('current_period_start', { mode: 'date' }).notNull(),
    currentPeriodEnd: timestamp('current_period_end', { mode: 'date' }).notNull(),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false).notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .$onUpdate(() => new Date())
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('user_subscriptions_user_idx').on(table.userId),
    index('user_subscriptions_stripe_sub_idx').on(table.stripeSubscriptionId),
  ],
);

export const follows = pgTable(
  'follows',
  {
    followerId: text('follower_id')
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' })
      .notNull(),
    followingId: text('following_id')
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.followerId, table.followingId],
    }),
    index('follows_follower_idx').on(table.followerId),
    index('follows_following_idx').on(table.followingId),
  ],
);

export const tweets = pgTable(
  'tweets',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    content: varchar('content', { length: 280 }),
    mediaUrl: text('media_url'),
    type: tweetType('type').default('TWEET').notNull(),
    originalTweetId: text('original_tweet_id').references((): AnyPgColumn => tweets.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    likeCount: integer('like_count').notNull().default(0),
    retweetCount: integer('retweet_count').notNull().default(0),
    quoteCount: integer('quote_count').notNull().default(0),
    commentCount: integer('comment_count').notNull().default(0),
    bookmarkCount: integer('bookmark_count').notNull().default(0),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('tweets_user_idx').on(table.userId),
    index('tweets_type_idx').on(table.type),
    index('tweets_original_idx').on(table.originalTweetId),
  ],
);

export const tweetComments = pgTable(
  'tweet_comments',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    tweetId: text('tweet_id')
      .notNull()
      .references(() => tweets.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    content: varchar('content', { length: 150 }).notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .$onUpdate(() => new Date())
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('tweet_comments_tweet_idx').on(table.tweetId),
    index('tweet_comments_user_idx').on(table.userId),
  ],
);

export const tweetLikes = pgTable(
  'tweet_likes',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    tweetId: text('tweet_id')
      .notNull()
      .references(() => tweets.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.tweetId] }),
    index('tweet_likes_user_idx').on(table.userId),
    index('tweet_likes_tweet_idx').on(table.tweetId),
  ],
);

export const tweetBookmarks = pgTable(
  'tweet_bookmarks',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    tweetId: text('tweet_id')
      .notNull()
      .references(() => tweets.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.tweetId] }),
    index('tweet_bookmarks_user_idx').on(table.userId),
    index('tweet_bookmarks_tweet_idx').on(table.tweetId),
  ],
);

export const notifications = pgTable(
  'notifications',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    recipientId: text('recipient_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    actorId: text('actor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    type: notificationType('type').notNull(),
    tweetId: text('tweet_id').references(() => tweets.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
    commentId: text('comment_id').references(() => tweetComments.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
    isRead: boolean('is_read').default(false).notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('notifications_recipient_idx').on(table.recipientId),
    index('notifications_actor_idx').on(table.actorId),
    index('notifications_type_idx').on(table.type),
    index('notifications_tweet_idx').on(table.tweetId),
  ],
);

export const accountRelations = relations(accounts, ({ one, many }) => ({
  user: one(users, {
    fields: [accounts.id],
    references: [users.accountId],
  }),
  sessions: many(sessions),
  verificationTokens: many(verificationTokens),
}));

export const userRelations = relations(users, ({ one, many }) => ({
  account: one(accounts, {
    fields: [users.accountId],
    references: [accounts.id],
  }),
  subscription: one(userSubscriptions, {
    fields: [users.id],
    references: [userSubscriptions.userId],
  }),
  verificationTokens: many(verificationTokens),
  sessions: many(sessions),
  tweets: many(tweets),
  comments: many(tweetComments),
  likes: many(tweetLikes),
  bookmarks: many(tweetBookmarks),
  followers: many(follows, { relationName: 'followers' }),
  following: many(follows, { relationName: 'following' }),
  actorNotifications: many(notifications, { relationName: 'actor' }),
  recipientNotifications: many(notifications, { relationName: 'recipient' }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
  account: one(accounts, {
    fields: [sessions.accountId],
    references: [accounts.id],
  }),
}));

export const verificationTokensRelations = relations(verificationTokens, ({ one }) => ({
  user: one(users, {
    fields: [verificationTokens.userId],
    references: [users.id],
  }),
  account: one(accounts, {
    fields: [verificationTokens.accountId],
    references: [accounts.id],
  }),
}));

export const userSubscriptionsRelations = relations(userSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [userSubscriptions.userId],
    references: [users.id],
  }),
}));

export const followsRelations = relations(follows, ({ one }) => ({
  follower: one(users, {
    fields: [follows.followerId],
    references: [users.id],
    relationName: 'followers',
  }),
  following: one(users, {
    fields: [follows.followingId],
    references: [users.id],
    relationName: 'following',
  }),
}));

export const tweetRelations = relations(tweets, ({ one, many }) => ({
  user: one(users, {
    fields: [tweets.userId],
    references: [users.id],
  }),
  originalTweet: one(tweets, {
    fields: [tweets.originalTweetId],
    references: [tweets.id],
  }),
  comments: many(tweetComments),
  likes: many(tweetLikes),
  bookmarks: many(tweetBookmarks),
  notifications: many(notifications),
}));

export const tweetCommentsRelations = relations(tweetComments, ({ one, many }) => ({
  user: one(users, {
    fields: [tweetComments.userId],
    references: [users.id],
  }),
  tweet: one(tweets, {
    fields: [tweetComments.tweetId],
    references: [tweets.id],
  }),
  notifications: many(notifications),
}));

export const tweetLikesRelations = relations(tweetLikes, ({ one }) => ({
  user: one(users, {
    fields: [tweetLikes.userId],
    references: [users.id],
  }),
  tweet: one(tweets, {
    fields: [tweetLikes.tweetId],
    references: [tweets.id],
  }),
}));

export const tweetBookmarksRelations = relations(tweetBookmarks, ({ one }) => ({
  user: one(users, {
    fields: [tweetBookmarks.userId],
    references: [users.id],
  }),
  tweet: one(tweets, {
    fields: [tweetBookmarks.tweetId],
    references: [tweets.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  recipient: one(users, {
    fields: [notifications.recipientId],
    references: [users.id],
    relationName: 'recipient',
  }),
  actor: one(users, {
    fields: [notifications.actorId],
    references: [users.id],
    relationName: 'actor',
  }),
  tweet: one(tweets, {
    fields: [notifications.tweetId],
    references: [tweets.id],
  }),
  comment: one(tweetComments, {
    fields: [notifications.commentId],
    references: [tweetComments.id],
  }),
}));
