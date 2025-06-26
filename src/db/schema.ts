import { createId } from '@paralleldrive/cuid2';
import { boolean, pgEnum, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';

export const accountType = pgEnum('account_type', ['PUBLIC', 'PRIVATE']);
export const tokenType = pgEnum('token_type', ['EMAIL_VERIFICATION', 'PASSWORD_RESET']);

export const accounts = pgTable('accounts', {
  id: text('id')
    .$defaultFn(() => createId())
    .primaryKey(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false),
  passwordHash: text('password_hash').notNull(),
  accountType: accountType('account_type').default('PUBLIC'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const users = pgTable('users', {
  id: text('id')
    .$defaultFn(() => createId())
    .primaryKey(),
  displayName: varchar('display_name', { length: 50 }).notNull(),
  userName: varchar('user_name', { length: 15 }).notNull().unique(),
  avatarUrl: text('avatar_url').default(
    'https://ozzfzo6f4u.ufs.sh/f/4E4gJXn0fX5QxhdfWFjG1B5cSivUhkuwMOLA4yI3CmFbWTNE',
  ),
  bio: varchar('bio', { length: 100 }).default(''),
  website: varchar('website', { length: 100 }).default(''),
  accountId: text('account_id')
    .references(() => accounts.id, { onUpdate: 'cascade', onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const refreshTokens = pgTable('refresh_tokens', {
  id: text('id')
    .$defaultFn(() => createId())
    .primaryKey(),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow(),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable('verification_tokens', {
  id: text('id')
    .$defaultFn(() => createId())
    .primaryKey(),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  token: text('token').notNull(),
  tokenType: tokenType('token_type').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow(),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
});
