CREATE TYPE "public"."account_type" AS ENUM('PUBLIC', 'PRIVATE');--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "avatar_url" SET DEFAULT 'https://ozzfzo6f4u.ufs.sh/f/4E4gJXn0fX5QxhdfWFjG1B5cSivUhkuwMOLA4yI3CmFbWTNE';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "avatar_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "account_type" "account_type" DEFAULT 'PUBLIC';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bio" text DEFAULT '';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "website" text DEFAULT '';