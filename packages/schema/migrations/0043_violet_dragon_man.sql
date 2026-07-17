ALTER TYPE "public"."file_purpose" ADD VALUE 'contest';--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "visibility" text DEFAULT 'public' NOT NULL;