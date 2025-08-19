ALTER TYPE "public"."standalone_tweet_type" RENAME TO "tweet_type";--> statement-breakpoint
ALTER TYPE "public"."standalone_verification_token_type" RENAME TO "verification_token_type";--> statement-breakpoint
ALTER TABLE "standalone_accounts" RENAME TO "accounts";--> statement-breakpoint
ALTER TABLE "standalone_follows" RENAME TO "follows";--> statement-breakpoint
ALTER TABLE "standalone_sessions" RENAME TO "sessions";--> statement-breakpoint
ALTER TABLE "standalone_tweet_comments" RENAME TO "tweet_comments";--> statement-breakpoint
ALTER TABLE "standalone_tweet_likes" RENAME TO "tweet_likes";--> statement-breakpoint
ALTER TABLE "standalone_tweets" RENAME TO "tweets";--> statement-breakpoint
ALTER TABLE "standalone_users" RENAME TO "users";--> statement-breakpoint
ALTER TABLE "standalone_verification_tokens" RENAME TO "verification_tokens";--> statement-breakpoint
ALTER TABLE "accounts" DROP CONSTRAINT "standalone_accounts_email_unique";--> statement-breakpoint
ALTER TABLE "sessions" DROP CONSTRAINT "standalone_sessions_refresh_token_unique";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "standalone_users_user_name_unique";--> statement-breakpoint
ALTER TABLE "follows" DROP CONSTRAINT "standalone_follows_follower_id_standalone_users_id_fk";
--> statement-breakpoint
ALTER TABLE "follows" DROP CONSTRAINT "standalone_follows_following_id_standalone_users_id_fk";
--> statement-breakpoint
ALTER TABLE "sessions" DROP CONSTRAINT "standalone_sessions_account_id_standalone_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "sessions" DROP CONSTRAINT "standalone_sessions_user_id_standalone_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tweet_comments" DROP CONSTRAINT "standalone_tweet_comments_user_id_standalone_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tweet_comments" DROP CONSTRAINT "standalone_tweet_comments_tweet_id_standalone_tweets_id_fk";
--> statement-breakpoint
ALTER TABLE "tweet_likes" DROP CONSTRAINT "standalone_tweet_likes_user_id_standalone_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tweet_likes" DROP CONSTRAINT "standalone_tweet_likes_tweet_id_standalone_tweets_id_fk";
--> statement-breakpoint
ALTER TABLE "tweets" DROP CONSTRAINT "standalone_tweets_user_id_standalone_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tweets" DROP CONSTRAINT "standalone_tweets_original_tweet_id_standalone_tweets_id_fk";
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "standalone_users_account_id_standalone_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "verification_tokens" DROP CONSTRAINT "standalone_verification_tokens_account_id_standalone_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "verification_tokens" DROP CONSTRAINT "standalone_verification_tokens_user_id_standalone_users_id_fk";
--> statement-breakpoint
DROP INDEX "standalone_follows_follower_idx";--> statement-breakpoint
DROP INDEX "standalone_follows_following_idx";--> statement-breakpoint
DROP INDEX "standalone_tweet_comments_tweet_idx";--> statement-breakpoint
DROP INDEX "standalone_tweet_comments_user_idx";--> statement-breakpoint
DROP INDEX "standalone_tweet_likes_user_idx";--> statement-breakpoint
DROP INDEX "standalone_tweet_likes_tweet_idx";--> statement-breakpoint
DROP INDEX "standalone_tweets_user_idx";--> statement-breakpoint
DROP INDEX "standalone_tweets_type_idx";--> statement-breakpoint
DROP INDEX "standalone_tweets_original_idx";--> statement-breakpoint
DROP INDEX "standalone_users_search_index";--> statement-breakpoint
ALTER TABLE "follows" DROP CONSTRAINT "standalone_follows_follower_id_following_id_pk";--> statement-breakpoint
ALTER TABLE "tweet_likes" DROP CONSTRAINT "standalone_tweet_likes_user_id_tweet_id_pk";--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_following_id_pk" PRIMARY KEY("follower_id","following_id");--> statement-breakpoint
ALTER TABLE "tweet_likes" ADD CONSTRAINT "tweet_likes_user_id_tweet_id_pk" PRIMARY KEY("user_id","tweet_id");--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_following_id_users_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tweet_comments" ADD CONSTRAINT "tweet_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tweet_comments" ADD CONSTRAINT "tweet_comments_tweet_id_tweets_id_fk" FOREIGN KEY ("tweet_id") REFERENCES "public"."tweets"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tweet_likes" ADD CONSTRAINT "tweet_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tweet_likes" ADD CONSTRAINT "tweet_likes_tweet_id_tweets_id_fk" FOREIGN KEY ("tweet_id") REFERENCES "public"."tweets"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tweets" ADD CONSTRAINT "tweets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tweets" ADD CONSTRAINT "tweets_original_tweet_id_tweets_id_fk" FOREIGN KEY ("original_tweet_id") REFERENCES "public"."tweets"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "follows_follower_idx" ON "follows" USING btree ("follower_id");--> statement-breakpoint
CREATE INDEX "follows_following_idx" ON "follows" USING btree ("following_id");--> statement-breakpoint
CREATE INDEX "tweet_comments_tweet_idx" ON "tweet_comments" USING btree ("tweet_id");--> statement-breakpoint
CREATE INDEX "tweet_comments_user_idx" ON "tweet_comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tweet_likes_user_idx" ON "tweet_likes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tweet_likes_tweet_idx" ON "tweet_likes" USING btree ("tweet_id");--> statement-breakpoint
CREATE INDEX "tweets_user_idx" ON "tweets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tweets_type_idx" ON "tweets" USING btree ("type");--> statement-breakpoint
CREATE INDEX "tweets_original_idx" ON "tweets" USING btree ("original_tweet_id");--> statement-breakpoint
CREATE INDEX "users_search_index" ON "users" USING gin (to_tsvector('english', "user_name" || ' ' || "display_name"));--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_email_unique" UNIQUE("email");--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_refresh_token_unique" UNIQUE("refresh_token");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_user_name_unique" UNIQUE("user_name");