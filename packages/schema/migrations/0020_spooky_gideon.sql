CREATE TABLE "metrics_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day" date NOT NULL,
	"metric" varchar(64) NOT NULL,
	"dimension" varchar(64) DEFAULT '' NOT NULL,
	"value" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_metrics_daily_day_metric_dim" ON "metrics_daily" USING btree ("day","metric","dimension");--> statement-breakpoint
CREATE INDEX "idx_metrics_daily_metric_day" ON "metrics_daily" USING btree ("metric","day");