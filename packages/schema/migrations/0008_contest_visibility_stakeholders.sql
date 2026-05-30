CREATE TYPE "public"."contest_visibility" AS ENUM('public', 'unlisted', 'private');--> statement-breakpoint
CREATE TABLE "contest_stakeholders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contest_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_contest_stakeholders_contest_user" UNIQUE("contest_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "contests" ADD COLUMN "visibility" "contest_visibility" DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "contests" ADD COLUMN "visible_to_roles" jsonb;--> statement-breakpoint
ALTER TABLE "contest_stakeholders" ADD CONSTRAINT "contest_stakeholders_contest_id_contests_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_stakeholders" ADD CONSTRAINT "contest_stakeholders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_contest_stakeholders_contest_id" ON "contest_stakeholders" USING btree ("contest_id");--> statement-breakpoint
CREATE INDEX "idx_contest_stakeholders_user_id" ON "contest_stakeholders" USING btree ("user_id");