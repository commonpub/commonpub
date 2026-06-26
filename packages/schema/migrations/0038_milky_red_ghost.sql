CREATE TYPE "public"."referral_attribution_status" AS ENUM('pending', 'confirmed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."referral_link_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TABLE "referral_attributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referral_link_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"referred_user_id" uuid NOT NULL,
	"status" "referral_attribution_status" DEFAULT 'pending' NOT NULL,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"code" varchar(40) NOT NULL,
	"label" varchar(80),
	"actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"landing_path" varchar(512),
	"status" "referral_link_status" DEFAULT 'active' NOT NULL,
	"attribution_window_days" integer DEFAULT 60 NOT NULL,
	"click_count" integer DEFAULT 0 NOT NULL,
	"signup_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "referral_attributions" ADD CONSTRAINT "referral_attributions_referral_link_id_referral_links_id_fk" FOREIGN KEY ("referral_link_id") REFERENCES "public"."referral_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_attributions" ADD CONSTRAINT "referral_attributions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_attributions" ADD CONSTRAINT "referral_attributions_referred_user_id_users_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_links" ADD CONSTRAINT "referral_links_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_referral_attr_user" ON "referral_attributions" USING btree ("referred_user_id");--> statement-breakpoint
CREATE INDEX "idx_referral_attr_owner" ON "referral_attributions" USING btree ("owner_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_referral_attr_link" ON "referral_attributions" USING btree ("referral_link_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_referral_links_code" ON "referral_links" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_referral_links_owner" ON "referral_links" USING btree ("owner_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);