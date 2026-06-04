ALTER TYPE "public"."contest_status" ADD VALUE 'draft' BEFORE 'upcoming';--> statement-breakpoint
ALTER TYPE "public"."contest_status" ADD VALUE 'paused' BEFORE 'judging';--> statement-breakpoint
ALTER TABLE "contests" ADD COLUMN "show_prizes" boolean DEFAULT true NOT NULL;