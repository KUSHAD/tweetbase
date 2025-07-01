ALTER TABLE "saas_accounts" ALTER COLUMN "account_type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "saas_accounts" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "saas_accounts" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "saas_sessions" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "saas_users" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "saas_users" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "saas_verification_tokens" ALTER COLUMN "created_at" SET NOT NULL;