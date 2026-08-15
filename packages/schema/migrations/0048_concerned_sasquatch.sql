CREATE TABLE "user_shared_links" (
	"user_id" uuid NOT NULL,
	"platform" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_shared_links_user_id_platform_pk" PRIMARY KEY("user_id","platform")
);
--> statement-breakpoint
CREATE TABLE "user_statistics_objections" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"objected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_shared_links" ADD CONSTRAINT "user_shared_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_statistics_objections" ADD CONSTRAINT "user_statistics_objections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;