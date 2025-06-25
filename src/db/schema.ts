import { createId } from "@paralleldrive/cuid2";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").$defaultFn(() => createId()).primaryKey(),
  displayName: text("display_name").notNull(),
  userName: text("user_name").notNull(),
  avatarUrl: text("avatar_url").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().$onUpdate(()=>new Date())
})