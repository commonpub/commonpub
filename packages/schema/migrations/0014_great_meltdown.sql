CREATE TYPE "public"."mirror_request_direction" AS ENUM('incoming', 'outgoing');--> statement-breakpoint
CREATE TYPE "public"."mirror_request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "mirror_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"direction" "mirror_request_direction" NOT NULL,
	"remote_domain" varchar(255) NOT NULL,
	"remote_actor_uri" text NOT NULL,
	"status" "mirror_request_status" DEFAULT 'pending' NOT NULL,
	"offer_activity_uri" text,
	"resulting_mirror_id" uuid,
	"last_error" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mirror_requests_direction_domain" UNIQUE("direction","remote_domain")
);
--> statement-breakpoint
ALTER TABLE "mirror_requests" ADD CONSTRAINT "mirror_requests_resulting_mirror_id_instance_mirrors_id_fk" FOREIGN KEY ("resulting_mirror_id") REFERENCES "public"."instance_mirrors"("id") ON DELETE set null ON UPDATE no action;