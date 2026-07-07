CREATE TYPE "public"."hub_flag_status" AS ENUM('open', 'dismissed', 'actioned');--> statement-breakpoint
CREATE TYPE "public"."hub_flag_target_type" AS ENUM('project', 'member');--> statement-breakpoint
ALTER TYPE "public"."hub_role" ADD VALUE 'steward' BEFORE 'member';--> statement-breakpoint
CREATE TABLE "hub_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hub_id" uuid NOT NULL,
	"target_type" "hub_flag_target_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"flagged_by_id" uuid NOT NULL,
	"reason" text,
	"status" "hub_flag_status" DEFAULT 'open' NOT NULL,
	"resolved_by_id" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_hub_flags_open" UNIQUE("hub_id","target_type","target_id","flagged_by_id")
);
--> statement-breakpoint
ALTER TABLE "hub_flags" ADD CONSTRAINT "hub_flags_hub_id_hubs_id_fk" FOREIGN KEY ("hub_id") REFERENCES "public"."hubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_flags" ADD CONSTRAINT "hub_flags_flagged_by_id_users_id_fk" FOREIGN KEY ("flagged_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_flags" ADD CONSTRAINT "hub_flags_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_hub_flags_hub_status" ON "hub_flags" USING btree ("hub_id","status");