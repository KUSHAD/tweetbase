ALTER TABLE "saas_tweets" DROP CONSTRAINT "saas_tweets_in_reply_to_tweet_id_saas_tweets_id_fk";
--> statement-breakpoint
DROP INDEX "tweet_reply_idx";--> statement-breakpoint
ALTER TABLE "saas_tweets" DROP COLUMN "in_reply_to_tweet_id";