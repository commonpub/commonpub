ALTER TABLE "contests" ADD COLUMN "stages" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "contests" ADD COLUMN "current_stage_id" text;