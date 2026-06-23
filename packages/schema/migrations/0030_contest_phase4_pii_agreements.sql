CREATE TABLE "contest_agreement_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contest_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"stage_id" text NOT NULL,
	"field_key" varchar(40) NOT NULL,
	"terms_hash" varchar(64) NOT NULL,
	"terms_snapshot" text NOT NULL,
	"ip" varchar(64),
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contest_entry_private_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contest_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_contest_entry_private_fields_entry" UNIQUE("entry_id")
);
--> statement-breakpoint
ALTER TABLE "contest_agreement_acceptances" ADD CONSTRAINT "contest_agreement_acceptances_contest_id_contests_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_agreement_acceptances" ADD CONSTRAINT "contest_agreement_acceptances_entry_id_contest_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."contest_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_agreement_acceptances" ADD CONSTRAINT "contest_agreement_acceptances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_entry_private_fields" ADD CONSTRAINT "contest_entry_private_fields_contest_id_contests_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_entry_private_fields" ADD CONSTRAINT "contest_entry_private_fields_entry_id_contest_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."contest_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_entry_private_fields" ADD CONSTRAINT "contest_entry_private_fields_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_contest_agreements_contest_id" ON "contest_agreement_acceptances" USING btree ("contest_id");--> statement-breakpoint
CREATE INDEX "idx_contest_agreements_entry_id" ON "contest_agreement_acceptances" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "idx_contest_entry_private_fields_contest_id" ON "contest_entry_private_fields" USING btree ("contest_id");--> statement-breakpoint
-- Phase 4 (contest PII): grant the new `contest.pii` capability to the staff role
-- (admin already holds `*`). Idempotent; mirrors STAFF_PERMISSION_SET in
-- packages/server/src/rbac/seed.ts. No-op on instances where the staff role row
-- does not yet exist (the RBAC seed in 0025 created it on RBAC-enabled instances).
INSERT INTO "role_permissions" ("role_id", "permission_key")
SELECT r."id", 'contest.pii' FROM "roles" r WHERE r."key" = 'staff'
ON CONFLICT DO NOTHING;