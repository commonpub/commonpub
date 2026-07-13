CREATE TABLE "contest_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contest_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_contest_registrations_contest_user" UNIQUE("contest_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "contest_reminder_sends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contest_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"milestone" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_contest_reminder_sends_contest_user_milestone" UNIQUE("contest_id","user_id","milestone")
);
--> statement-breakpoint
ALTER TABLE "contest_registrations" ADD CONSTRAINT "contest_registrations_contest_id_contests_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_registrations" ADD CONSTRAINT "contest_registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_reminder_sends" ADD CONSTRAINT "contest_reminder_sends_contest_id_contests_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_reminder_sends" ADD CONSTRAINT "contest_reminder_sends_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_contest_registrations_contest_id" ON "contest_registrations" USING btree ("contest_id");--> statement-breakpoint
CREATE INDEX "idx_contest_registrations_user_id" ON "contest_registrations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_contest_reminder_sends_contest_id" ON "contest_reminder_sends" USING btree ("contest_id");