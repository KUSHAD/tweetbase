DROP INDEX "idx_saas_follows_follower_id";--> statement-breakpoint
DROP INDEX "idx_saas_follows_following_id";--> statement-breakpoint
DROP INDEX "idx_saas_tweet_comments_tweet_id";--> statement-breakpoint
DROP INDEX "idx_saas_tweet_comments_user_id";--> statement-breakpoint
DROP INDEX "idx_saas_tweet_likes_user_id";--> statement-breakpoint
DROP INDEX "idx_saas_tweet_likes_tweet_id";--> statement-breakpoint
DROP INDEX "idx_saas_tweets_user_id";--> statement-breakpoint
DROP INDEX "idx_saas_tweets_type";--> statement-breakpoint
DROP INDEX "idx_saas_tweets_original_tweet_id";--> statement-breakpoint
DROP INDEX "idx_saas_users_search_gin";--> statement-breakpoint
CREATE INDEX "saas_follows_follower_idx" ON "saas_follows" USING btree ("follower_id");--> statement-breakpoint
CREATE INDEX "saas_follows_following_idx" ON "saas_follows" USING btree ("following_id");--> statement-breakpoint
CREATE INDEX "saas_tweet_comments_tweet_idx" ON "saas_tweet_comments" USING btree ("tweet_id");--> statement-breakpoint
CREATE INDEX "saas_tweet_comments_user_idx" ON "saas_tweet_comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "saas_tweet_likes_user_idx" ON "saas_tweet_likes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "saas_tweet_likes_tweet_idx" ON "saas_tweet_likes" USING btree ("tweet_id");--> statement-breakpoint
CREATE INDEX "saas_tweets_user_idx" ON "saas_tweets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "saas_tweets_type_idx" ON "saas_tweets" USING btree ("type");--> statement-breakpoint
CREATE INDEX "saas_tweets_original_idx" ON "saas_tweets" USING btree ("original_tweet_id");--> statement-breakpoint
CREATE INDEX "saas_users_search_index" ON "saas_users" USING gin (to_tsvector('english', "user_name" || ' ' || "display_name"));