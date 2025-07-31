import { alias } from 'drizzle-orm/pg-core';
import { standaloneTweets, standaloneUsers } from '../db/schema';

export const originalTweet = alias(standaloneTweets, 'original_tweet');
export const originalTweetUser = alias(standaloneUsers, 'original_tweet_user');
