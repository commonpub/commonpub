CREATE TABLE "persona_metrics_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day" date NOT NULL,
	"metric" varchar(64) NOT NULL,
	"dimension" varchar(120) DEFAULT '' NOT NULL,
	"value" bigint NOT NULL,
	"suppressed" boolean DEFAULT false NOT NULL,
	"final" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_persona_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"section_key" varchar(40) NOT NULL,
	"field_key" varchar(40) NOT NULL,
	"value" varchar(120) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_persona_text" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"section_key" varchar(40) NOT NULL,
	"field_key" varchar(40) NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_purpose_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" varchar(24) NOT NULL,
	"state" varchar(16) NOT NULL,
	"scope_digest" varchar(16) NOT NULL,
	"scope_snapshot" jsonb NOT NULL,
	"policy_version" varchar(32) NOT NULL,
	"source" varchar(24) NOT NULL,
	"acted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"superseded_at" timestamp with time zone,
	"ip_address" varchar(45),
	"user_agent" text
);
--> statement-breakpoint
ALTER TABLE "user_persona_answers" ADD CONSTRAINT "user_persona_answers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_persona_text" ADD CONSTRAINT "user_persona_text_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_purpose_consents" ADD CONSTRAINT "user_purpose_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_persona_metrics_daily_day_metric_dim" ON "persona_metrics_daily" USING btree ("day","metric","dimension");--> statement-breakpoint
CREATE INDEX "idx_persona_metrics_daily_metric_day" ON "persona_metrics_daily" USING btree ("metric","day");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_persona_answer" ON "user_persona_answers" USING btree ("user_id","field_key","value");--> statement-breakpoint
CREATE INDEX "idx_persona_answer_field_value" ON "user_persona_answers" USING btree ("field_key","value");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_persona_text" ON "user_persona_text" USING btree ("user_id","field_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_purpose_current" ON "user_purpose_consents" USING btree ("user_id","purpose") WHERE "user_purpose_consents"."superseded_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_purpose_consent_lookup" ON "user_purpose_consents" USING btree ("purpose","state","scope_digest");