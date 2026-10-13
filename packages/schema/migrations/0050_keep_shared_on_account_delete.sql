-- Session 262: deleting an account no longer deletes what other people use.
-- Contests, hubs, docs sites, events, learning paths and products refuse the
-- delete while their creator still owns them (deleteUser checks first and says
-- what to hand over); audit entries and hub bans outlive the person who made them.
-- Constraint changes only: no row is read, written or removed.
ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "contests" DROP CONSTRAINT IF EXISTS "contests_created_by_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "docs_sites" DROP CONSTRAINT IF EXISTS "docs_sites_owner_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_created_by_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "hub_bans" DROP CONSTRAINT IF EXISTS "hub_bans_banned_by_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "hubs" DROP CONSTRAINT IF EXISTS "hubs_created_by_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_created_by_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "learning_paths" DROP CONSTRAINT IF EXISTS "learning_paths_author_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "hub_bans" ALTER COLUMN "banned_by_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contests" ADD CONSTRAINT "contests_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs_sites" ADD CONSTRAINT "docs_sites_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_bans" ADD CONSTRAINT "hub_bans_banned_by_id_users_id_fk" FOREIGN KEY ("banned_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hubs" ADD CONSTRAINT "hubs_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;