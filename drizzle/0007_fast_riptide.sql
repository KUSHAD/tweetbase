CREATE TABLE "saas_retweets" (
	"user_id" text NOT NULL,
	"tweet_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "saas_retweets_user_id_tweet_id_pk" PRIMARY KEY("user_id","tweet_id")
);
--> statement-breakpoint
CREATE TABLE "saas_tweet_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tweet_id" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saas_tweet_likes" (
	"user_id" text NOT NULL,
	"tweet_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "saas_tweet_likes_user_id_tweet_id_pk" PRIMARY KEY("user_id","tweet_id")
);
--> statement-breakpoint
CREATE TABLE "saas_tweets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"content" text NOT NULL,
	"in_reply_to_tweet_id" text,
	"quoted_tweet_id" text,
	"media_url" text,
	"media_type" text,
	"like_count" integer DEFAULT 0 NOT NULL,
	"retweet_count" integer DEFAULT 0 NOT NULL,
	"quote_count" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saas_retweets" ADD CONSTRAINT "saas_retweets_user_id_saas_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."saas_users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "saas_retweets" ADD CONSTRAINT "saas_retweets_tweet_id_saas_tweets_id_fk" FOREIGN KEY ("tweet_id") REFERENCES "public"."saas_tweets"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "saas_tweet_comments" ADD CONSTRAINT "saas_tweet_comments_user_id_saas_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."saas_users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "saas_tweet_comments" ADD CONSTRAINT "saas_tweet_comments_tweet_id_saas_tweets_id_fk" FOREIGN KEY ("tweet_id") REFERENCES "public"."saas_tweets"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "saas_tweet_likes" ADD CONSTRAINT "saas_tweet_likes_user_id_saas_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."saas_users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "saas_tweet_likes" ADD CONSTRAINT "saas_tweet_likes_tweet_id_saas_tweets_id_fk" FOREIGN KEY ("tweet_id") REFERENCES "public"."saas_tweets"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "saas_tweets" ADD CONSTRAINT "saas_tweets_user_id_saas_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."saas_users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "saas_tweets" ADD CONSTRAINT "saas_tweets_in_reply_to_tweet_id_saas_tweets_id_fk" FOREIGN KEY ("in_reply_to_tweet_id") REFERENCES "public"."saas_tweets"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "saas_tweets" ADD CONSTRAINT "saas_tweets_quoted_tweet_id_saas_tweets_id_fk" FOREIGN KEY ("quoted_tweet_id") REFERENCES "public"."saas_tweets"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "retweet_user_idx" ON "saas_retweets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "retweet_tweet_idx" ON "saas_retweets" USING btree ("tweet_id");--> statement-breakpoint
CREATE INDEX "comment_tweet_idx" ON "saas_tweet_comments" USING btree ("tweet_id");--> statement-breakpoint
CREATE INDEX "comment_user_idx" ON "saas_tweet_comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "like_user_idx" ON "saas_tweet_likes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "like_tweet_idx" ON "saas_tweet_likes" USING btree ("tweet_id");--> statement-breakpoint
CREATE INDEX "tweet_user_idx" ON "saas_tweets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tweet_reply_idx" ON "saas_tweets" USING btree ("in_reply_to_tweet_id");--> statement-breakpoint
CREATE INDEX "tweet_quote_idx" ON "saas_tweets" USING btree ("quoted_tweet_id");