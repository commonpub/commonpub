CREATE TABLE "contest_registration_private_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contest_id" uuid NOT NULL,
	"registration_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_contest_registration_private_fields_registration" UNIQUE("registration_id")
);
--> statement-breakpoint
ALTER TABLE "contest_agreement_acceptances" ALTER COLUMN "entry_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "contest_agreement_acceptances" ALTER COLUMN "stage_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "contest_agreement_acceptances" ADD COLUMN "registration_id" uuid;--> statement-breakpoint
ALTER TABLE "contests" ADD COLUMN "registration_template" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "contests" ADD COLUMN "registration_mode" text DEFAULT 'light' NOT NULL;--> statement-breakpoint
ALTER TABLE "contest_registration_private_fields" ADD CONSTRAINT "contest_registration_private_fields_contest_id_contests_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_registration_private_fields" ADD CONSTRAINT "contest_registration_private_fields_registration_id_contest_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."contest_registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_registration_private_fields" ADD CONSTRAINT "contest_registration_private_fields_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_contest_registration_private_fields_contest_id" ON "contest_registration_private_fields" USING btree ("contest_id");--> statement-breakpoint
ALTER TABLE "contest_agreement_acceptances" ADD CONSTRAINT "contest_agreement_acceptances_registration_id_contest_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."contest_registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_contest_agreements_registration_id" ON "contest_agreement_acceptances" USING btree ("registration_id");--> statement-breakpoint
ALTER TABLE "contest_agreement_acceptances" ADD CONSTRAINT "uq_contest_agreements_registration_field_terms" UNIQUE("registration_id","field_key","terms_hash");--> statement-breakpoint
ALTER TABLE "contest_agreement_acceptances" ADD CONSTRAINT "contest_agreements_one_scope" CHECK (("contest_agreement_acceptances"."entry_id" IS NOT NULL AND "contest_agreement_acceptances"."registration_id" IS NULL) OR ("contest_agreement_acceptances"."entry_id" IS NULL AND "contest_agreement_acceptances"."registration_id" IS NOT NULL));