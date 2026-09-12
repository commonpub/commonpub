CREATE TABLE "contest_announcement_sends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"announcement_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_contest_announcement_sends_announcement_user" UNIQUE("announcement_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "contest_announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contest_id" uuid NOT NULL,
	"idempotency_key" varchar(64) NOT NULL,
	"subject" text NOT NULL,
	"body_blocks" jsonb NOT NULL,
	"audience" jsonb NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'sending' NOT NULL,
	"sent_at" timestamp with time zone,
	"sent_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_contest_announcements_contest_idempotency" UNIQUE("contest_id","idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "contest_registrations" ADD COLUMN "email_opt_out_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contest_announcement_sends" ADD CONSTRAINT "contest_announcement_sends_announcement_id_contest_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."contest_announcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_announcement_sends" ADD CONSTRAINT "contest_announcement_sends_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_announcements" ADD CONSTRAINT "contest_announcements_contest_id_contests_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_announcements" ADD CONSTRAINT "contest_announcements_sent_by_id_users_id_fk" FOREIGN KEY ("sent_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_contest_announcement_sends_user_id" ON "contest_announcement_sends" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_contest_announcements_contest_created" ON "contest_announcements" USING btree ("contest_id","created_at");