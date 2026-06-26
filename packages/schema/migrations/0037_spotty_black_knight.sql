CREATE TABLE "broadcasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject" text NOT NULL,
	"body_text" text NOT NULL,
	"cta_label" text,
	"cta_url" text,
	"audience" jsonb NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"sent_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_sent_by_id_users_id_fk" FOREIGN KEY ("sent_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_broadcasts_created_at" ON "broadcasts" USING btree ("created_at");