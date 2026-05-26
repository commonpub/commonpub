CREATE TABLE "layout_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"layout_id" uuid NOT NULL,
	"zone" varchar(64) NOT NULL,
	"position" integer NOT NULL,
	"config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "layout_rows_position_unique" UNIQUE("layout_id","zone","position")
);
--> statement-breakpoint
CREATE TABLE "layout_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"row_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"type" varchar(128) NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"col_span" integer DEFAULT 12 NOT NULL,
	"responsive" jsonb,
	"visibility" jsonb,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "layout_sections_position_unique" UNIQUE("row_id","position"),
	CONSTRAINT "layout_sections_col_span_check" CHECK ("layout_sections"."col_span" between 1 and 12)
);
--> statement-breakpoint
CREATE TABLE "layout_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"layout_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"published_by" uuid,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "layout_versions_version_unique" UNIQUE("layout_id","version")
);
--> statement-breakpoint
CREATE TABLE "layouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope_type" varchar(32) NOT NULL,
	"scope_key" varchar(512) NOT NULL,
	"name" varchar(256) NOT NULL,
	"page_meta" jsonb,
	"state" varchar(16) DEFAULT 'draft' NOT NULL,
	"published_version_id" uuid,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "layouts_scope_unique" UNIQUE("scope_type","scope_key")
);
--> statement-breakpoint
ALTER TABLE "layout_rows" ADD CONSTRAINT "layout_rows_layout_id_layouts_id_fk" FOREIGN KEY ("layout_id") REFERENCES "public"."layouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "layout_sections" ADD CONSTRAINT "layout_sections_row_id_layout_rows_id_fk" FOREIGN KEY ("row_id") REFERENCES "public"."layout_rows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "layout_versions" ADD CONSTRAINT "layout_versions_layout_id_layouts_id_fk" FOREIGN KEY ("layout_id") REFERENCES "public"."layouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "layout_versions" ADD CONSTRAINT "layout_versions_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "layouts" ADD CONSTRAINT "layouts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "layouts" ADD CONSTRAINT "layouts_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_layout_rows_layout" ON "layout_rows" USING btree ("layout_id","zone","position");--> statement-breakpoint
CREATE INDEX "idx_layout_sections_row" ON "layout_sections" USING btree ("row_id","position");--> statement-breakpoint
CREATE INDEX "idx_layout_sections_type" ON "layout_sections" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_layout_versions_layout" ON "layout_versions" USING btree ("layout_id","version");--> statement-breakpoint
CREATE INDEX "idx_layouts_scope" ON "layouts" USING btree ("scope_type","scope_key");