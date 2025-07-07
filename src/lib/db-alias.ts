import { alias } from 'drizzle-orm/pg-core';
import { saasTweets, saasUsers } from '../db/schema';

export const originalTweet = alias(saasTweets, 'original_tweet');
export const originalTweetUser = alias(saasUsers, 'original_tweet_user');
