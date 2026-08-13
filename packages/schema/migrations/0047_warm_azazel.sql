CREATE TABLE "disclosure_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" varchar(40) NOT NULL,
	"api_key_id" uuid,
	"user_id" uuid NOT NULL,
	"purpose" varchar(24) NOT NULL,
	"scope_digest" varchar(16) NOT NULL,
	"disclosed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "recipient_id" varchar(40);--> statement-breakpoint
ALTER TABLE "disclosure_events" ADD CONSTRAINT "disclosure_events_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disclosure_events" ADD CONSTRAINT "disclosure_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_disclosure_user_time" ON "disclosure_events" USING btree ("user_id","disclosed_at");--> statement-breakpoint
CREATE INDEX "idx_disclosure_recipient_time" ON "disclosure_events" USING btree ("recipient_id","disclosed_at");