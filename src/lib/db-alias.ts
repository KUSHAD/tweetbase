import { alias } from 'drizzle-orm/pg-core';
import { tweets, users } from '../db/schema';

export const originalTweet = alias(tweets, 'original_tweet');
export const originalTweetUser = alias(users, 'original_tweet_user');
