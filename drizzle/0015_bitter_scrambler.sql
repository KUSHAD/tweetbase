ALTER TYPE "public"."saas_verification_token_type" RENAME TO "standalone_verification_token_type";--> statement-breakpoint
ALTER TABLE "saas_accounts" RENAME TO "standalone_accounts";--> statement-breakpoint
ALTER TABLE "saas_follows" RENAME TO "standalone_follows";--> statement-breakpoint
ALTER TABLE "saas_sessions" RENAME TO "standalone_sessions";--> statement-breakpoint
ALTER TABLE "saas_tweet_comments" RENAME TO "standalone_tweet_comments";--> statement-breakpoint
ALTER TABLE "saas_tweet_likes" RENAME TO "standalone_tweet_likes";--> statement-breakpoint
ALTER TABLE "saas_tweets" RENAME TO "standalone_tweets";--> statement-breakpoint
ALTER TABLE "saas_users" RENAME TO "standalone_users";--> statement-breakpoint
ALTER TABLE "saas_verification_tokens" RENAME TO "standalone_verification_tokens";--> statement-breakpoint
ALTER TABLE "standalone_accounts" DROP CONSTRAINT "saas_accounts_email_unique";--> statement-breakpoint
ALTER TABLE "standalone_sessions" DROP CONSTRAINT "saas_sessions_refresh_token_unique";--> statement-breakpoint
ALTER TABLE "standalone_users" DROP CONSTRAINT "saas_users_user_name_unique";--> statement-breakpoint
ALTER TABLE "standalone_follows" DROP CONSTRAINT "saas_follows_follower_id_saas_users_id_fk";
--> statement-breakpoint
ALTER TABLE "standalone_follows" DROP CONSTRAINT "saas_follows_following_id_saas_users_id_fk";
--> statement-breakpoint
ALTER TABLE "standalone_sessions" DROP CONSTRAINT "saas_sessions_account_id_saas_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "standalone_sessions" DROP CONSTRAINT "saas_sessions_user_id_saas_users_id_fk";
--> statement-breakpoint
ALTER TABLE "standalone_tweet_comments" DROP CONSTRAINT "saas_tweet_comments_user_id_saas_users_id_fk";
--> statement-breakpoint
ALTER TABLE "standalone_tweet_comments" DROP CONSTRAINT "saas_tweet_comments_tweet_id_saas_tweets_id_fk";
--> statement-breakpoint
ALTER TABLE "standalone_tweet_likes" DROP CONSTRAINT "saas_tweet_likes_user_id_saas_users_id_fk";
--> statement-breakpoint
ALTER TABLE "standalone_tweet_likes" DROP CONSTRAINT "saas_tweet_likes_tweet_id_saas_tweets_id_fk";
--> statement-breakpoint
ALTER TABLE "standalone_tweets" DROP CONSTRAINT "saas_tweets_user_id_saas_users_id_fk";
--> statement-breakpoint
ALTER TABLE "standalone_tweets" DROP CONSTRAINT "saas_tweets_original_tweet_id_saas_tweets_id_fk";
--> statement-breakpoint
ALTER TABLE "standalone_users" DROP CONSTRAINT "saas_users_account_id_saas_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "standalone_verification_tokens" DROP CONSTRAINT "saas_verification_tokens_account_id_saas_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "standalone_verification_tokens" DROP CONSTRAINT "saas_verification_tokens_user_id_saas_users_id_fk";
--> statement-breakpoint
DROP INDEX "saas_follows_follower_idx";--> statement-breakpoint
DROP INDEX "saas_follows_following_idx";--> statement-breakpoint
DROP INDEX "saas_tweet_comments_tweet_idx";--> statement-breakpoint
DROP INDEX "saas_tweet_comments_user_idx";--> statement-breakpoint
DROP INDEX "saas_tweet_likes_user_idx";--> statement-breakpoint
DROP INDEX "saas_tweet_likes_tweet_idx";--> statement-breakpoint
DROP INDEX "saas_tweets_user_idx";--> statement-breakpoint
DROP INDEX "saas_tweets_type_idx";--> statement-breakpoint
DROP INDEX "saas_tweets_original_idx";--> statement-breakpoint
DROP INDEX "saas_users_search_index";--> statement-breakpoint
ALTER TABLE "standalone_follows" DROP CONSTRAINT "saas_follows_follower_id_following_id_pk";--> statement-breakpoint
ALTER TABLE "standalone_tweet_likes" DROP CONSTRAINT "saas_tweet_likes_user_id_tweet_id_pk";--> statement-breakpoint
ALTER TABLE "standalone_follows" ADD CONSTRAINT "standalone_follows_follower_id_following_id_pk" PRIMARY KEY("follower_id","following_id");--> statement-breakpoint
ALTER TABLE "standalone_tweet_likes" ADD CONSTRAINT "standalone_tweet_likes_user_id_tweet_id_pk" PRIMARY KEY("user_id","tweet_id");--> statement-breakpoint
ALTER TABLE "standalone_follows" ADD CONSTRAINT "standalone_follows_follower_id_standalone_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."standalone_users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "standalone_follows" ADD CONSTRAINT "standalone_follows_following_id_standalone_users_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."standalone_users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "standalone_sessions" ADD CONSTRAINT "standalone_sessions_account_id_standalone_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."standalone_accounts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "standalone_sessions" ADD CONSTRAINT "standalone_sessions_user_id_standalone_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."standalone_users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "standalone_tweet_comments" ADD CONSTRAINT "standalone_tweet_comments_user_id_standalone_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."standalone_users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "standalone_tweet_comments" ADD CONSTRAINT "standalone_tweet_comments_tweet_id_standalone_tweets_id_fk" FOREIGN KEY ("tweet_id") REFERENCES "public"."standalone_tweets"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "standalone_tweet_likes" ADD CONSTRAINT "standalone_tweet_likes_user_id_standalone_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."standalone_users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "standalone_tweet_likes" ADD CONSTRAINT "standalone_tweet_likes_tweet_id_standalone_tweets_id_fk" FOREIGN KEY ("tweet_id") REFERENCES "public"."standalone_tweets"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "standalone_tweets" ADD CONSTRAINT "standalone_tweets_user_id_standalone_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."standalone_users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "standalone_tweets" ADD CONSTRAINT "standalone_tweets_original_tweet_id_standalone_tweets_id_fk" FOREIGN KEY ("original_tweet_id") REFERENCES "public"."standalone_tweets"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "standalone_users" ADD CONSTRAINT "standalone_users_account_id_standalone_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."standalone_accounts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "standalone_verification_tokens" ADD CONSTRAINT "standalone_verification_tokens_account_id_standalone_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."standalone_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standalone_verification_tokens" ADD CONSTRAINT "standalone_verification_tokens_user_id_standalone_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."standalone_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "standalone_follows_follower_idx" ON "standalone_follows" USING btree ("follower_id");--> statement-breakpoint
CREATE INDEX "standalone_follows_following_idx" ON "standalone_follows" USING btree ("following_id");--> statement-breakpoint
CREATE INDEX "standalone_tweet_comments_tweet_idx" ON "standalone_tweet_comments" USING btree ("tweet_id");--> statement-breakpoint
CREATE INDEX "standalone_tweet_comments_user_idx" ON "standalone_tweet_comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "standalone_tweet_likes_user_idx" ON "standalone_tweet_likes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "standalone_tweet_likes_tweet_idx" ON "standalone_tweet_likes" USING btree ("tweet_id");--> statement-breakpoint
CREATE INDEX "standalone_tweets_user_idx" ON "standalone_tweets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "standalone_tweets_type_idx" ON "standalone_tweets" USING btree ("type");--> statement-breakpoint
CREATE INDEX "standalone_tweets_original_idx" ON "standalone_tweets" USING btree ("original_tweet_id");--> statement-breakpoint
CREATE INDEX "standalone_users_search_index" ON "standalone_users" USING gin (to_tsvector('english', "user_name" || ' ' || "display_name"));--> statement-breakpoint
ALTER TABLE "standalone_accounts" ADD CONSTRAINT "standalone_accounts_email_unique" UNIQUE("email");--> statement-breakpoint
ALTER TABLE "standalone_sessions" ADD CONSTRAINT "standalone_sessions_refresh_token_unique" UNIQUE("refresh_token");--> statement-breakpoint
ALTER TABLE "standalone_users" ADD CONSTRAINT "standalone_users_user_name_unique" UNIQUE("user_name");