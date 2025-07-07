DROP INDEX "follower_idx";--> statement-breakpoint
DROP INDEX "following_idx";--> statement-breakpoint
DROP INDEX "comment_tweet_idx";--> statement-breakpoint
DROP INDEX "comment_user_idx";--> statement-breakpoint
DROP INDEX "like_user_idx";--> statement-breakpoint
DROP INDEX "like_tweet_idx";--> statement-breakpoint
DROP INDEX "tweet_user_idx";--> statement-breakpoint
DROP INDEX "tweet_type_idx";--> statement-breakpoint
DROP INDEX "tweet_original_idx";--> statement-breakpoint
DROP INDEX "user_search_index";--> statement-breakpoint
CREATE INDEX "idx_saas_follows_follower_id" ON "saas_follows" USING btree ("follower_id");--> statement-breakpoint
CREATE INDEX "idx_saas_follows_following_id" ON "saas_follows" USING btree ("following_id");--> statement-breakpoint
CREATE INDEX "idx_saas_tweet_comments_tweet_id" ON "saas_tweet_comments" USING btree ("tweet_id");--> statement-breakpoint
CREATE INDEX "idx_saas_tweet_comments_user_id" ON "saas_tweet_comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_saas_tweet_likes_user_id" ON "saas_tweet_likes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_saas_tweet_likes_tweet_id" ON "saas_tweet_likes" USING btree ("tweet_id");--> statement-breakpoint
CREATE INDEX "idx_saas_tweets_user_id" ON "saas_tweets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_saas_tweets_type" ON "saas_tweets" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_saas_tweets_original_tweet_id" ON "saas_tweets" USING btree ("original_tweet_id");--> statement-breakpoint
CREATE INDEX "idx_saas_users_search_gin" ON "saas_users" USING gin (to_tsvector('english', "user_name" || ' ' || "display_name"));