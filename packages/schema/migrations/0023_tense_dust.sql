ALTER TABLE "contests" ADD COLUMN "description_format" "contest_content_format" DEFAULT 'markdown' NOT NULL;--> statement-breakpoint
ALTER TABLE "contests" ADD COLUMN "rules_format" "contest_content_format" DEFAULT 'markdown' NOT NULL;--> statement-breakpoint
ALTER TABLE "contests" ADD COLUMN "prizes_description_format" "contest_content_format" DEFAULT 'markdown' NOT NULL;