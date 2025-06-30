CREATE TYPE "public"."saas_account_type" AS ENUM('PUBLIC', 'PRIVATE');--> statement-breakpoint
CREATE TYPE "public"."saas_verification_token_type" AS ENUM('EMAIL_VERIFICATION', 'PASSWORD_RESET');--> statement-breakpoint
CREATE TABLE "saas_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false,
	"password_hash" text NOT NULL,
	"account_type" "saas_account_type" DEFAULT 'PUBLIC',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "saas_accounts_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "saas_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"user_id" text NOT NULL,
	"refresh_token" text NOT NULL,
	"user_agent" text,
	"ip_address" text,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "saas_sessions_refresh_token_unique" UNIQUE("refresh_token")
);
--> statement-breakpoint
CREATE TABLE "saas_users" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" varchar(50) NOT NULL,
	"user_name" varchar(15) NOT NULL,
	"avatar_url" text DEFAULT 'https://ozzfzo6f4u.ufs.sh/f/4E4gJXn0fX5QxhdfWFjG1B5cSivUhkuwMOLA4yI3CmFbWTNE',
	"bio" varchar(100) DEFAULT '',
	"website" varchar(100) DEFAULT '',
	"account_id" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "saas_users_user_name_unique" UNIQUE("user_name")
);
--> statement-breakpoint
CREATE TABLE "saas_verification_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"token_type" "saas_verification_token_type" NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saas_sessions" ADD CONSTRAINT "saas_sessions_account_id_saas_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."saas_accounts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "saas_sessions" ADD CONSTRAINT "saas_sessions_user_id_saas_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."saas_users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "saas_users" ADD CONSTRAINT "saas_users_account_id_saas_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."saas_accounts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "saas_verification_tokens" ADD CONSTRAINT "saas_verification_tokens_account_id_saas_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."saas_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_verification_tokens" ADD CONSTRAINT "saas_verification_tokens_user_id_saas_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."saas_users"("id") ON DELETE cascade ON UPDATE no action;