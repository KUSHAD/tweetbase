CREATE INDEX "follower_idx" ON "saas_follows" USING btree ("follower_id");--> statement-breakpoint
CREATE INDEX "following_idx" ON "saas_follows" USING btree ("following_id");