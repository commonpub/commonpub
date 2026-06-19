CREATE TABLE "processed_activities" (
	"activity_id" text PRIMARY KEY NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "digest_runs" (
	"digest_date" varchar(10) PRIMARY KEY NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_processed_activities_seen_at" ON "processed_activities" USING btree ("seen_at");--> statement-breakpoint
CREATE INDEX "idx_content_items_author_status" ON "content_items" USING btree ("author_id","status");--> statement-breakpoint
CREATE INDEX "idx_content_items_type_status_published" ON "content_items" USING btree ("type","status","published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_notifications_user_created" ON "notifications" USING btree ("user_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);