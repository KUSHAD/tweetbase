CREATE TABLE "tweet_bookmarks" (
	"user_id" text NOT NULL,
	"tweet_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tweet_bookmarks_user_id_tweet_id_pk" PRIMARY KEY("user_id","tweet_id")
);
--> statement-breakpoint
ALTER TABLE "tweets" ADD COLUMN "bookmark_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tweet_bookmarks" ADD CONSTRAINT "tweet_bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tweet_bookmarks" ADD CONSTRAINT "tweet_bookmarks_tweet_id_tweets_id_fk" FOREIGN KEY ("tweet_id") REFERENCES "public"."tweets"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "tweet_bookmarks_user_idx" ON "tweet_bookmarks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tweet_bookmarks_tweet_idx" ON "tweet_bookmarks" USING btree ("tweet_id");