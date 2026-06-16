ALTER TYPE "public"."content_status" ADD VALUE 'scheduled' BEFORE 'published';--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "scheduled_at" timestamp with time zone;