ALTER TABLE "users" ALTER COLUMN "display_name" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "user_name" SET DATA TYPE varchar(15);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "bio" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "bio" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "website" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "website" SET DEFAULT '';