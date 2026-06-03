CREATE TYPE "public"."registry_instance_status" AS ENUM('active', 'hidden', 'blocked');--> statement-breakpoint
CREATE TABLE "registry_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" varchar(255) NOT NULL,
	"actor_uri" text NOT NULL,
	"name" varchar(256),
	"description" text,
	"user_count" integer DEFAULT 0 NOT NULL,
	"active_month_count" integer DEFAULT 0 NOT NULL,
	"local_post_count" integer DEFAULT 0 NOT NULL,
	"features" jsonb,
	"software_name" varchar(64),
	"software_version" varchar(32),
	"status" "registry_instance_status" DEFAULT 'active' NOT NULL,
	"last_ping_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registry_instances_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE INDEX "idx_registry_instances_status" ON "registry_instances" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_registry_instances_last_ping" ON "registry_instances" USING btree ("last_ping_at");