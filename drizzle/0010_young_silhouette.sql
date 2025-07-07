CREATE TYPE "public"."tweet_type" AS ENUM('TWEET', 'RETWEET', 'QUOTE');--> statement-breakpoint
ALTER TABLE "saas_retweets" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "saas_retweets" CASCADE;--> statement-breakpoint
ALTER TABLE "saas_tweets" DROP CONSTRAINT "saas_tweets_quoted_tweet_id_saas_tweets_id_fk";
--> statement-breakpoint
DROP INDEX "tweet_quote_idx";--> statement-breakpoint
ALTER TABLE "saas_tweets" ALTER COLUMN "content" SET DATA TYPE varchar(280);--> statement-breakpoint
ALTER TABLE "saas_tweets" ALTER COLUMN "content" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "saas_tweets" ADD COLUMN "type" "tweet_type" DEFAULT 'TWEET' NOT NULL;--> statement-breakpoint
ALTER TABLE "saas_tweets" ADD COLUMN "original_tweet_id" text;--> statement-breakpoint
ALTER TABLE "saas_tweets" ADD CONSTRAINT "saas_tweets_original_tweet_id_saas_tweets_id_fk" FOREIGN KEY ("original_tweet_id") REFERENCES "public"."saas_tweets"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "tweet_type_idx" ON "saas_tweets" USING btree ("type");--> statement-breakpoint
CREATE INDEX "tweet_original_idx" ON "saas_tweets" USING btree ("original_tweet_id");--> statement-breakpoint
ALTER TABLE "saas_tweets" DROP COLUMN "quoted_tweet_id";--> statement-breakpoint
ALTER TABLE "saas_tweets" DROP COLUMN "media_type";