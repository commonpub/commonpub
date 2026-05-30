ALTER TABLE "contests" ADD COLUMN "eligible_content_types" jsonb;--> statement-breakpoint
ALTER TABLE "contests" ADD COLUMN "max_entries_per_user" integer;