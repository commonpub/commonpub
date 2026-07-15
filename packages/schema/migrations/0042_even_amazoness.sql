ALTER TABLE "contest_registrations" ADD COLUMN "tier" text DEFAULT 'full' NOT NULL;--> statement-breakpoint
ALTER TABLE "contest_registrations" ADD COLUMN "fields" jsonb;