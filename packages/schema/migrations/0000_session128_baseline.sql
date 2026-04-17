CREATE TYPE "public"."activity_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."activity_status" AS ENUM('pending', 'delivered', 'failed', 'processed');--> statement-breakpoint
CREATE TYPE "public"."bookmark_target_type" AS ENUM('project', 'article', 'blog', 'explainer', 'learning_path');--> statement-breakpoint
CREATE TYPE "public"."comment_target_type" AS ENUM('project', 'article', 'blog', 'explainer', 'post', 'lesson', 'video');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."content_type" AS ENUM('project', 'article', 'blog', 'explainer');--> statement-breakpoint
CREATE TYPE "public"."content_visibility" AS ENUM('public', 'members', 'private');--> statement-breakpoint
CREATE TYPE "public"."contest_status" AS ENUM('upcoming', 'active', 'judging', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."difficulty" AS ENUM('beginner', 'intermediate', 'advanced');--> statement-breakpoint
CREATE TYPE "public"."docs_page_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."event_attendee_status" AS ENUM('registered', 'waitlisted', 'cancelled', 'attended');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('draft', 'published', 'active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('in-person', 'online', 'hybrid');--> statement-breakpoint
CREATE TYPE "public"."file_purpose" AS ENUM('cover', 'content', 'avatar', 'banner', 'attachment');--> statement-breakpoint
CREATE TYPE "public"."follow_relationship_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."hub_follow_status" AS ENUM('pending', 'joined');--> statement-breakpoint
CREATE TYPE "public"."hub_join_policy" AS ENUM('open', 'approval', 'invite');--> statement-breakpoint
CREATE TYPE "public"."hub_member_status" AS ENUM('pending', 'active');--> statement-breakpoint
CREATE TYPE "public"."hub_privacy" AS ENUM('public', 'unlisted', 'private');--> statement-breakpoint
CREATE TYPE "public"."hub_role" AS ENUM('owner', 'admin', 'moderator', 'member');--> statement-breakpoint
CREATE TYPE "public"."hub_type" AS ENUM('community', 'product', 'company');--> statement-breakpoint
CREATE TYPE "public"."judge_role" AS ENUM('lead', 'judge', 'guest');--> statement-breakpoint
CREATE TYPE "public"."judging_visibility" AS ENUM('public', 'judges-only', 'private');--> statement-breakpoint
CREATE TYPE "public"."lesson_type" AS ENUM('article', 'video', 'quiz', 'project', 'explainer');--> statement-breakpoint
CREATE TYPE "public"."like_target_type" AS ENUM('project', 'article', 'blog', 'explainer', 'comment', 'post', 'video');--> statement-breakpoint
CREATE TYPE "public"."mirror_direction" AS ENUM('pull', 'push');--> statement-breakpoint
CREATE TYPE "public"."mirror_status" AS ENUM('pending', 'active', 'paused', 'failed');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('like', 'comment', 'follow', 'mention', 'contest', 'event', 'certificate', 'hub', 'system', 'fork', 'build');--> statement-breakpoint
CREATE TYPE "public"."post_type" AS ENUM('text', 'link', 'share', 'poll', 'discussion', 'question', 'showcase', 'announcement');--> statement-breakpoint
CREATE TYPE "public"."product_category" AS ENUM('microcontroller', 'sbc', 'sensor', 'actuator', 'display', 'communication', 'power', 'mechanical', 'software', 'tool', 'other');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('active', 'discontinued', 'preview');--> statement-breakpoint
CREATE TYPE "public"."profile_visibility" AS ENUM('public', 'members', 'private');--> statement-breakpoint
CREATE TYPE "public"."report_reason" AS ENUM('spam', 'harassment', 'inappropriate', 'copyright', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('pending', 'reviewed', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."report_target_type" AS ENUM('project', 'article', 'blog', 'post', 'comment', 'user', 'explainer');--> statement-breakpoint
CREATE TYPE "public"."resource_category" AS ENUM('documentation', 'tools', 'tutorials', 'community', 'hardware', 'software', 'other');--> statement-breakpoint
CREATE TYPE "public"."tag_category" AS ENUM('platform', 'language', 'framework', 'topic', 'general');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('member', 'pro', 'verified', 'staff', 'admin');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."video_platform" AS ENUM('youtube', 'vimeo', 'other');--> statement-breakpoint
CREATE TYPE "public"."vote_direction" AS ENUM('up', 'down');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"action" varchar(64) NOT NULL,
	"target_type" varchar(64) NOT NULL,
	"target_id" varchar(255),
	"metadata" jsonb,
	"ip_address" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instance_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(128) NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instance_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider_id" varchar(32) NOT NULL,
	"account_id" varchar(255) NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"password" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "federated_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"actor_uri" text NOT NULL,
	"instance_domain" varchar(255) NOT NULL,
	"preferred_username" varchar(64),
	"display_name" varchar(128),
	"avatar_url" text,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "federated_accounts_actor_uri_unique" UNIQUE("actor_uri")
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(32) DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar(255) NOT NULL,
	"client_secret" varchar(512) NOT NULL,
	"redirect_uris" jsonb NOT NULL,
	"instance_domain" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_clients_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "oauth_codes" (
	"code" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"client_id" varchar(255) NOT NULL,
	"redirect_uri" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"slug" varchar(128) NOT NULL,
	"logo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" varchar(512) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"username" varchar(64) NOT NULL,
	"display_username" varchar(64),
	"display_name" varchar(128),
	"bio" text,
	"headline" varchar(255),
	"location" varchar(128),
	"website" varchar(512),
	"avatar_url" text,
	"banner_url" text,
	"social_links" jsonb,
	"role" "user_role" DEFAULT 'member' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"profile_visibility" "profile_visibility" DEFAULT 'public' NOT NULL,
	"skills" jsonb,
	"experience" jsonb,
	"theme" varchar(64),
	"pronouns" varchar(32),
	"timezone" varchar(64),
	"email_notifications" jsonb,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_builds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_builds_user_content" UNIQUE("user_id","content_id")
);
--> statement-breakpoint
CREATE TABLE "content_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(64) NOT NULL,
	"slug" varchar(64) NOT NULL,
	"description" varchar(255),
	"color" varchar(32),
	"icon" varchar(64),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "content_forks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"fork_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"type" "content_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"subtitle" varchar(255),
	"description" text,
	"content" jsonb,
	"cover_image_url" text,
	"banner_url" text,
	"category" varchar(64),
	"difficulty" "difficulty",
	"build_time" varchar(64),
	"estimated_cost" varchar(64),
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"visibility" "content_visibility" DEFAULT 'public' NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_editorial" boolean DEFAULT false NOT NULL,
	"editorial_note" varchar(255),
	"category_id" uuid,
	"seo_description" varchar(320),
	"preview_token" varchar(64),
	"parts" jsonb,
	"sections" jsonb,
	"license_type" varchar(32),
	"series" varchar(128),
	"estimated_minutes" integer,
	"canonical_url" text,
	"ap_object_id" text,
	"deleted_at" timestamp with time zone,
	"view_count" integer DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"fork_count" integer DEFAULT 0 NOT NULL,
	"build_count" integer DEFAULT 0 NOT NULL,
	"boost_count" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_items_author_type_slug" UNIQUE("author_id","type","slug")
);
--> statement-breakpoint
CREATE TABLE "content_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"title" varchar(255),
	"content" jsonb,
	"metadata" jsonb,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(64) NOT NULL,
	"slug" varchar(64) NOT NULL,
	"category" varchar(32),
	"usage_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name"),
	CONSTRAINT "tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "contest_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contest_id" uuid NOT NULL,
	"content_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"score" integer,
	"rank" integer,
	"judge_scores" jsonb,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contest_entries_user_content" UNIQUE("contest_id","user_id","content_id")
);
--> statement-breakpoint
CREATE TABLE "contest_judges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contest_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "judge_role" DEFAULT 'judge' NOT NULL,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	CONSTRAINT "uq_contest_judges_contest_user" UNIQUE("contest_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "contests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"rules" text,
	"banner_url" text,
	"status" "contest_status" DEFAULT 'upcoming' NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"judging_end_date" timestamp with time zone,
	"prizes" jsonb,
	"judging_visibility" "judging_visibility" DEFAULT 'judges-only' NOT NULL,
	"judges" jsonb,
	"created_by_id" uuid NOT NULL,
	"community_voting_enabled" boolean DEFAULT false NOT NULL,
	"entry_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contests_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "docs_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"sidebar_label" varchar(128),
	"description" text,
	"content" jsonb NOT NULL,
	"status" "docs_page_status" DEFAULT 'draft' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"parent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "docs_pages_version_slug" UNIQUE("version_id","slug")
);
--> statement-breakpoint
CREATE TABLE "docs_sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"slug" varchar(128) NOT NULL,
	"description" text,
	"owner_id" uuid NOT NULL,
	"theme_tokens" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "docs_sites_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "docs_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"version" varchar(32) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "docs_versions_site_version" UNIQUE("site_id","version")
);
--> statement-breakpoint
CREATE TABLE "event_attendees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "event_attendee_status" DEFAULT 'registered' NOT NULL,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"cover_image" text,
	"event_type" "event_type" DEFAULT 'in-person' NOT NULL,
	"status" "event_status" DEFAULT 'draft' NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"timezone" varchar(64) DEFAULT 'UTC' NOT NULL,
	"location" varchar(500),
	"location_url" varchar(500),
	"online_url" varchar(500),
	"capacity" integer,
	"attendee_count" integer DEFAULT 0 NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"hub_id" uuid,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(64) NOT NULL,
	"actor_uri" text NOT NULL,
	"object_uri" text,
	"payload" jsonb NOT NULL,
	"direction" "activity_direction" NOT NULL,
	"status" "activity_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"locked_at" timestamp with time zone,
	"dead_lettered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "actor_keypairs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"public_key_pem" text NOT NULL,
	"private_key_pem" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "actor_keypairs_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "federated_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"object_uri" text NOT NULL,
	"actor_uri" text NOT NULL,
	"remote_actor_id" uuid,
	"origin_domain" varchar(255) NOT NULL,
	"ap_type" varchar(32) NOT NULL,
	"title" text,
	"content" text,
	"summary" text,
	"url" text,
	"cover_image_url" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"in_reply_to" text,
	"cpub_type" varchar(32),
	"cpub_metadata" jsonb,
	"cpub_blocks" jsonb,
	"local_like_count" integer DEFAULT 0 NOT NULL,
	"local_comment_count" integer DEFAULT 0 NOT NULL,
	"local_boost_count" integer DEFAULT 0 NOT NULL,
	"local_view_count" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"mirror_id" uuid,
	"is_hidden" boolean DEFAULT false NOT NULL,
	CONSTRAINT "federated_content_object_uri_unique" UNIQUE("object_uri")
);
--> statement-breakpoint
CREATE TABLE "federated_content_builds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"federated_content_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fed_content_builds_user_content" UNIQUE("user_id","federated_content_id")
);
--> statement-breakpoint
CREATE TABLE "federated_hub_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"federated_hub_id" uuid NOT NULL,
	"remote_actor_id" uuid NOT NULL,
	"discovered_via" varchar(32) DEFAULT 'post' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_fed_hub_members_hub_actor" UNIQUE("federated_hub_id","remote_actor_id")
);
--> statement-breakpoint
CREATE TABLE "federated_hub_post_likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_fed_hub_post_likes_post_user" UNIQUE("post_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "federated_hub_post_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"federated_hub_post_id" uuid NOT NULL,
	"author_id" uuid,
	"remote_actor_uri" text,
	"remote_actor_name" text,
	"parent_id" uuid,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "federated_hub_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"federated_hub_id" uuid NOT NULL,
	"object_uri" text NOT NULL,
	"actor_uri" text NOT NULL,
	"remote_actor_id" uuid,
	"content" text NOT NULL,
	"post_type" varchar(32) DEFAULT 'text' NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"local_like_count" integer DEFAULT 0 NOT NULL,
	"local_reply_count" integer DEFAULT 0 NOT NULL,
	"remote_like_count" integer DEFAULT 0 NOT NULL,
	"remote_reply_count" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"shared_content_meta" jsonb,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "federated_hub_posts_object_uri_unique" UNIQUE("object_uri")
);
--> statement-breakpoint
CREATE TABLE "federated_hub_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"federated_hub_id" uuid NOT NULL,
	"object_uri" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(32),
	"image_url" text,
	"purchase_url" text,
	"datasheet_url" text,
	"specs" jsonb,
	"pricing" jsonb,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "federated_hub_products_object_uri_unique" UNIQUE("object_uri")
);
--> statement-breakpoint
CREATE TABLE "federated_hub_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"federated_hub_id" uuid NOT NULL,
	"object_uri" text NOT NULL,
	"title" varchar(255) NOT NULL,
	"url" text NOT NULL,
	"description" text,
	"category" varchar(32) DEFAULT 'other' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "federated_hub_resources_object_uri_unique" UNIQUE("object_uri")
);
--> statement-breakpoint
CREATE TABLE "federated_hubs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_uri" text NOT NULL,
	"remote_actor_id" uuid,
	"origin_domain" varchar(255) NOT NULL,
	"remote_slug" varchar(128) NOT NULL,
	"name" varchar(256) NOT NULL,
	"description" text,
	"icon_url" text,
	"banner_url" text,
	"hub_type" varchar(32) DEFAULT 'community' NOT NULL,
	"remote_member_count" integer DEFAULT 0 NOT NULL,
	"remote_post_count" integer DEFAULT 0 NOT NULL,
	"local_post_count" integer DEFAULT 0 NOT NULL,
	"status" "follow_relationship_status" DEFAULT 'pending' NOT NULL,
	"follow_activity_uri" text,
	"url" text,
	"rules" text,
	"categories" jsonb,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"last_sync_at" timestamp with time zone,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "federated_hubs_actor_uri_unique" UNIQUE("actor_uri")
);
--> statement-breakpoint
CREATE TABLE "follow_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"follower_actor_uri" text NOT NULL,
	"following_actor_uri" text NOT NULL,
	"activity_uri" text,
	"status" "follow_relationship_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follow_relationships_pair" UNIQUE("follower_actor_uri","following_actor_uri")
);
--> statement-breakpoint
CREATE TABLE "instance_health" (
	"domain" varchar(255) PRIMARY KEY NOT NULL,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"total_delivered" integer DEFAULT 0 NOT NULL,
	"total_failed" integer DEFAULT 0 NOT NULL,
	"circuit_open_until" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_failure_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instance_mirrors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"remote_domain" varchar(255) NOT NULL,
	"remote_actor_uri" text NOT NULL,
	"status" "mirror_status" DEFAULT 'pending' NOT NULL,
	"direction" "mirror_direction" NOT NULL,
	"filter_content_types" jsonb,
	"filter_tags" jsonb,
	"content_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"last_sync_at" timestamp with time zone,
	"paused_at" timestamp with time zone,
	"backfill_cursor" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instance_mirrors_remote_domain_unique" UNIQUE("remote_domain")
);
--> statement-breakpoint
CREATE TABLE "remote_actors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_uri" text NOT NULL,
	"inbox" text NOT NULL,
	"outbox" text,
	"shared_inbox" text,
	"public_key_pem" text,
	"preferred_username" varchar(64),
	"display_name" varchar(128),
	"summary" text,
	"avatar_url" text,
	"banner_url" text,
	"actor_type" varchar(32) DEFAULT 'Person' NOT NULL,
	"instance_domain" varchar(255) NOT NULL,
	"follower_count" integer,
	"following_count" integer,
	"last_fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "remote_actors_actor_uri_unique" UNIQUE("actor_uri")
);
--> statement-breakpoint
CREATE TABLE "user_federated_hub_follows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"federated_hub_id" uuid NOT NULL,
	"status" "hub_follow_status" DEFAULT 'pending' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_user_fed_hub_follow" UNIQUE("user_id","federated_hub_id")
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uploader_id" uuid NOT NULL,
	"filename" varchar(255) NOT NULL,
	"original_name" varchar(255),
	"mime_type" varchar(128) NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_key" text NOT NULL,
	"public_url" text,
	"purpose" "file_purpose" DEFAULT 'attachment' NOT NULL,
	"content_id" uuid,
	"hub_id" uuid,
	"width" integer,
	"height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_actor_keypairs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hub_id" uuid NOT NULL,
	"public_key_pem" text NOT NULL,
	"private_key_pem" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hub_actor_keypairs_hub_id_unique" UNIQUE("hub_id")
);
--> statement-breakpoint
CREATE TABLE "hub_bans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hub_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"banned_by_id" uuid NOT NULL,
	"reason" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_followers_fed" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hub_id" uuid NOT NULL,
	"follower_actor_uri" text NOT NULL,
	"activity_uri" text,
	"status" "follow_relationship_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hub_followers_fed_pair" UNIQUE("hub_id","follower_actor_uri")
);
--> statement-breakpoint
CREATE TABLE "hub_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hub_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"token" varchar(64) NOT NULL,
	"max_uses" integer,
	"use_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hub_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "hub_members" (
	"hub_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "hub_role" DEFAULT 'member' NOT NULL,
	"status" "hub_member_status" DEFAULT 'active' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hub_members_hub_id_user_id_pk" PRIMARY KEY("hub_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "hub_post_likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_hub_post_likes_post_user" UNIQUE("post_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "hub_post_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"author_id" uuid,
	"parent_id" uuid,
	"content" text NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"remote_actor_uri" text,
	"remote_actor_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hub_id" uuid NOT NULL,
	"author_id" uuid,
	"type" "post_type" DEFAULT 'text' NOT NULL,
	"content" text NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"vote_score" integer DEFAULT 0 NOT NULL,
	"reply_count" integer DEFAULT 0 NOT NULL,
	"remote_actor_uri" text,
	"remote_actor_name" text,
	"last_edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hub_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"url" text NOT NULL,
	"description" text,
	"category" "resource_category" DEFAULT 'other' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"added_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hub_id" uuid NOT NULL,
	"content_id" uuid NOT NULL,
	"shared_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_hub_shares_hub_content" UNIQUE("hub_id","content_id")
);
--> statement-breakpoint
CREATE TABLE "hubs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"slug" varchar(128) NOT NULL,
	"description" text,
	"rules" text,
	"icon_url" text,
	"banner_url" text,
	"hub_type" "hub_type" DEFAULT 'community' NOT NULL,
	"privacy" "hub_privacy" DEFAULT 'public' NOT NULL,
	"join_policy" "hub_join_policy" DEFAULT 'open' NOT NULL,
	"parent_hub_id" uuid,
	"website" varchar(512),
	"categories" jsonb,
	"created_by_id" uuid NOT NULL,
	"is_official" boolean DEFAULT false NOT NULL,
	"member_count" integer DEFAULT 0 NOT NULL,
	"post_count" integer DEFAULT 0 NOT NULL,
	"ap_actor_id" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hubs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"target_type" "bookmark_target_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookmarks_user_target" UNIQUE("user_id","target_type","target_id")
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"target_type" "comment_target_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"parent_id" uuid,
	"content" text NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participants" jsonb NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"follower_id" uuid NOT NULL,
	"following_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follows_pair" UNIQUE("follower_id","following_id")
);
--> statement-breakpoint
CREATE TABLE "likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"target_type" "like_target_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "likes_user_target" UNIQUE("user_id","target_type","target_id")
);
--> statement-breakpoint
CREATE TABLE "message_reads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_message_reads" UNIQUE("message_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"link" varchar(512),
	"actor_id" uuid,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"target_type" "report_target_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"reason" "report_reason" NOT NULL,
	"description" text,
	"status" "report_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by_id" uuid,
	"reviewed_at" timestamp with time zone,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"role" varchar(64),
	"notes" text,
	"required" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"hub_id" uuid NOT NULL,
	"category" "product_category",
	"specs" jsonb,
	"image_url" text,
	"purchase_url" text,
	"datasheet_url" text,
	"alternatives" jsonb,
	"pricing" jsonb,
	"status" "product_status" DEFAULT 'active' NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"path_id" uuid NOT NULL,
	"verification_code" varchar(64) NOT NULL,
	"certificate_url" text,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "certificates_verification_code_unique" UNIQUE("verification_code"),
	CONSTRAINT "certificates_user_path" UNIQUE("user_id","path_id")
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"path_id" uuid NOT NULL,
	"progress" numeric(5, 2) DEFAULT '0' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "enrollments_user_path" UNIQUE("user_id","path_id")
);
--> statement-breakpoint
CREATE TABLE "learning_lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"type" "lesson_type" NOT NULL,
	"content" jsonb,
	"content_item_id" uuid,
	"duration_minutes" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learning_lessons_module_slug" UNIQUE("module_id","slug")
);
--> statement-breakpoint
CREATE TABLE "learning_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_paths" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"cover_image_url" text,
	"difficulty" "difficulty",
	"estimated_hours" numeric(5, 1),
	"author_id" uuid NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"enrollment_count" integer DEFAULT 0 NOT NULL,
	"completion_count" integer DEFAULT 0 NOT NULL,
	"average_rating" numeric(3, 2),
	"review_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learning_paths_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "lesson_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"quiz_score" numeric(5, 2),
	"quiz_passed" boolean,
	CONSTRAINT "lesson_progress_user_lesson" UNIQUE("user_id","lesson_id")
);
--> statement-breakpoint
CREATE TABLE "video_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(64) NOT NULL,
	"slug" varchar(64) NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "video_categories_name_unique" UNIQUE("name"),
	CONSTRAINT "video_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"url" text NOT NULL,
	"embed_url" text,
	"platform" "video_platform" NOT NULL,
	"thumbnail_url" text,
	"duration" varchar(16),
	"category_id" uuid,
	"view_count" integer DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contest_entry_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_contest_entry_votes_entry_user" UNIQUE("entry_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "hub_post_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"direction" "vote_direction" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_hub_post_votes_post_user" UNIQUE("post_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "poll_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"label" varchar(255) NOT NULL,
	"vote_count" integer DEFAULT 0 NOT NULL,
	"order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"option_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_poll_votes_post_user" UNIQUE("post_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "api_key_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_id" uuid NOT NULL,
	"endpoint" varchar(200) NOT NULL,
	"method" varchar(10) DEFAULT 'GET' NOT NULL,
	"status_code" integer NOT NULL,
	"latency_ms" integer,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"prefix" varchar(32) NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"description" text,
	"allowed_origins" jsonb,
	"rate_limit_per_minute" integer DEFAULT 60 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instance_settings" ADD CONSTRAINT "instance_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federated_accounts" ADD CONSTRAINT "federated_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_codes" ADD CONSTRAINT "oauth_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_builds" ADD CONSTRAINT "content_builds_content_id_content_items_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_builds" ADD CONSTRAINT "content_builds_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_forks" ADD CONSTRAINT "content_forks_source_id_content_items_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_forks" ADD CONSTRAINT "content_forks_fork_id_content_items_id_fk" FOREIGN KEY ("fork_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_category_id_content_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."content_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_tags" ADD CONSTRAINT "content_tags_content_id_content_items_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_tags" ADD CONSTRAINT "content_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_content_id_content_items_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_entries" ADD CONSTRAINT "contest_entries_contest_id_contests_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_entries" ADD CONSTRAINT "contest_entries_content_id_content_items_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_entries" ADD CONSTRAINT "contest_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_judges" ADD CONSTRAINT "contest_judges_contest_id_contests_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_judges" ADD CONSTRAINT "contest_judges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contests" ADD CONSTRAINT "contests_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs_pages" ADD CONSTRAINT "docs_pages_version_id_docs_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."docs_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs_sites" ADD CONSTRAINT "docs_sites_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs_versions" ADD CONSTRAINT "docs_versions_site_id_docs_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."docs_sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_attendees" ADD CONSTRAINT "event_attendees_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_attendees" ADD CONSTRAINT "event_attendees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_hub_id_hubs_id_fk" FOREIGN KEY ("hub_id") REFERENCES "public"."hubs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actor_keypairs" ADD CONSTRAINT "actor_keypairs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federated_content" ADD CONSTRAINT "federated_content_remote_actor_id_remote_actors_id_fk" FOREIGN KEY ("remote_actor_id") REFERENCES "public"."remote_actors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federated_content_builds" ADD CONSTRAINT "federated_content_builds_federated_content_id_federated_content_id_fk" FOREIGN KEY ("federated_content_id") REFERENCES "public"."federated_content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federated_content_builds" ADD CONSTRAINT "federated_content_builds_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federated_hub_members" ADD CONSTRAINT "federated_hub_members_federated_hub_id_federated_hubs_id_fk" FOREIGN KEY ("federated_hub_id") REFERENCES "public"."federated_hubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federated_hub_members" ADD CONSTRAINT "federated_hub_members_remote_actor_id_remote_actors_id_fk" FOREIGN KEY ("remote_actor_id") REFERENCES "public"."remote_actors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federated_hub_post_likes" ADD CONSTRAINT "federated_hub_post_likes_post_id_federated_hub_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."federated_hub_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federated_hub_post_likes" ADD CONSTRAINT "federated_hub_post_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federated_hub_post_replies" ADD CONSTRAINT "federated_hub_post_replies_federated_hub_post_id_federated_hub_posts_id_fk" FOREIGN KEY ("federated_hub_post_id") REFERENCES "public"."federated_hub_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federated_hub_post_replies" ADD CONSTRAINT "federated_hub_post_replies_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federated_hub_posts" ADD CONSTRAINT "federated_hub_posts_federated_hub_id_federated_hubs_id_fk" FOREIGN KEY ("federated_hub_id") REFERENCES "public"."federated_hubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federated_hub_posts" ADD CONSTRAINT "federated_hub_posts_remote_actor_id_remote_actors_id_fk" FOREIGN KEY ("remote_actor_id") REFERENCES "public"."remote_actors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federated_hub_products" ADD CONSTRAINT "federated_hub_products_federated_hub_id_federated_hubs_id_fk" FOREIGN KEY ("federated_hub_id") REFERENCES "public"."federated_hubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federated_hub_resources" ADD CONSTRAINT "federated_hub_resources_federated_hub_id_federated_hubs_id_fk" FOREIGN KEY ("federated_hub_id") REFERENCES "public"."federated_hubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "federated_hubs" ADD CONSTRAINT "federated_hubs_remote_actor_id_remote_actors_id_fk" FOREIGN KEY ("remote_actor_id") REFERENCES "public"."remote_actors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_federated_hub_follows" ADD CONSTRAINT "user_federated_hub_follows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_federated_hub_follows" ADD CONSTRAINT "user_federated_hub_follows_federated_hub_id_federated_hubs_id_fk" FOREIGN KEY ("federated_hub_id") REFERENCES "public"."federated_hubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_content_id_content_items_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_hub_id_hubs_id_fk" FOREIGN KEY ("hub_id") REFERENCES "public"."hubs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_actor_keypairs" ADD CONSTRAINT "hub_actor_keypairs_hub_id_hubs_id_fk" FOREIGN KEY ("hub_id") REFERENCES "public"."hubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_bans" ADD CONSTRAINT "hub_bans_hub_id_hubs_id_fk" FOREIGN KEY ("hub_id") REFERENCES "public"."hubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_bans" ADD CONSTRAINT "hub_bans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_bans" ADD CONSTRAINT "hub_bans_banned_by_id_users_id_fk" FOREIGN KEY ("banned_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_followers_fed" ADD CONSTRAINT "hub_followers_fed_hub_id_hubs_id_fk" FOREIGN KEY ("hub_id") REFERENCES "public"."hubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_invites" ADD CONSTRAINT "hub_invites_hub_id_hubs_id_fk" FOREIGN KEY ("hub_id") REFERENCES "public"."hubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_invites" ADD CONSTRAINT "hub_invites_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_members" ADD CONSTRAINT "hub_members_hub_id_hubs_id_fk" FOREIGN KEY ("hub_id") REFERENCES "public"."hubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_members" ADD CONSTRAINT "hub_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_post_likes" ADD CONSTRAINT "hub_post_likes_post_id_hub_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."hub_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_post_likes" ADD CONSTRAINT "hub_post_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_post_replies" ADD CONSTRAINT "hub_post_replies_post_id_hub_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."hub_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_post_replies" ADD CONSTRAINT "hub_post_replies_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_posts" ADD CONSTRAINT "hub_posts_hub_id_hubs_id_fk" FOREIGN KEY ("hub_id") REFERENCES "public"."hubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_posts" ADD CONSTRAINT "hub_posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_resources" ADD CONSTRAINT "hub_resources_hub_id_hubs_id_fk" FOREIGN KEY ("hub_id") REFERENCES "public"."hubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_resources" ADD CONSTRAINT "hub_resources_added_by_id_users_id_fk" FOREIGN KEY ("added_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_shares" ADD CONSTRAINT "hub_shares_hub_id_hubs_id_fk" FOREIGN KEY ("hub_id") REFERENCES "public"."hubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_shares" ADD CONSTRAINT "hub_shares_content_id_content_items_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_shares" ADD CONSTRAINT "hub_shares_shared_by_id_users_id_fk" FOREIGN KEY ("shared_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hubs" ADD CONSTRAINT "hubs_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_following_id_users_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reads" ADD CONSTRAINT "message_reads_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reads" ADD CONSTRAINT "message_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_products" ADD CONSTRAINT "content_products_content_id_content_items_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_products" ADD CONSTRAINT "content_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_hub_id_hubs_id_fk" FOREIGN KEY ("hub_id") REFERENCES "public"."hubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_path_id_learning_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "public"."learning_paths"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_path_id_learning_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "public"."learning_paths"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_lessons" ADD CONSTRAINT "learning_lessons_module_id_learning_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."learning_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_lessons" ADD CONSTRAINT "learning_lessons_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_modules" ADD CONSTRAINT "learning_modules_path_id_learning_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "public"."learning_paths"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_learning_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."learning_lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_category_id_video_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."video_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_entry_votes" ADD CONSTRAINT "contest_entry_votes_entry_id_contest_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."contest_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_entry_votes" ADD CONSTRAINT "contest_entry_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_post_votes" ADD CONSTRAINT "hub_post_votes_post_id_hub_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."hub_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_post_votes" ADD CONSTRAINT "hub_post_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_post_id_hub_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."hub_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_option_id_poll_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."poll_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_post_id_hub_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."hub_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_key_usage" ADD CONSTRAINT "api_key_usage_key_id_api_keys_id_fk" FOREIGN KEY ("key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_logs_user_id" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_content_builds_content_id" ON "content_builds" USING btree ("content_id");--> statement-breakpoint
CREATE INDEX "idx_content_forks_source_id" ON "content_forks" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "idx_content_forks_fork_id" ON "content_forks" USING btree ("fork_id");--> statement-breakpoint
CREATE INDEX "idx_content_items_author_id" ON "content_items" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "idx_content_items_status" ON "content_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_content_items_type" ON "content_items" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_content_items_published_at" ON "content_items" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "idx_content_items_is_editorial" ON "content_items" USING btree ("is_editorial");--> statement-breakpoint
CREATE INDEX "idx_content_items_category_id" ON "content_items" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_content_tags_content_id" ON "content_tags" USING btree ("content_id");--> statement-breakpoint
CREATE INDEX "idx_content_tags_tag_id" ON "content_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "idx_content_versions_content_id" ON "content_versions" USING btree ("content_id");--> statement-breakpoint
CREATE INDEX "idx_contest_entries_contest_id" ON "contest_entries" USING btree ("contest_id");--> statement-breakpoint
CREATE INDEX "idx_contest_entries_user_id" ON "contest_entries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_contest_judges_contest_id" ON "contest_judges" USING btree ("contest_id");--> statement-breakpoint
CREATE INDEX "idx_contest_judges_user_id" ON "contest_judges" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_contests_created_by_id" ON "contests" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "idx_contests_status" ON "contests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_docs_pages_version_id" ON "docs_pages" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "idx_docs_pages_parent_id" ON "docs_pages" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_docs_sites_owner_id" ON "docs_sites" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_docs_versions_site_id" ON "docs_versions" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "idx_event_attendees_event_id" ON "event_attendees" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_event_attendees_user_id" ON "event_attendees" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_events_created_by_id" ON "events" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "idx_events_status" ON "events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_events_start_date" ON "events" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "idx_events_hub_id" ON "events" USING btree ("hub_id");--> statement-breakpoint
CREATE INDEX "idx_activities_direction_status" ON "activities" USING btree ("direction","status");--> statement-breakpoint
CREATE INDEX "idx_activities_actor_uri" ON "activities" USING btree ("actor_uri");--> statement-breakpoint
CREATE INDEX "idx_activities_created_at" ON "activities" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_fedcontent_actor_uri" ON "federated_content" USING btree ("actor_uri");--> statement-breakpoint
CREATE INDEX "idx_fedcontent_origin_domain" ON "federated_content" USING btree ("origin_domain");--> statement-breakpoint
CREATE INDEX "idx_fedcontent_received_at" ON "federated_content" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "idx_fedcontent_ap_type" ON "federated_content" USING btree ("ap_type");--> statement-breakpoint
CREATE INDEX "idx_fedcontent_cpub_type" ON "federated_content" USING btree ("cpub_type");--> statement-breakpoint
CREATE INDEX "idx_fedcontent_mirror_id" ON "federated_content" USING btree ("mirror_id");--> statement-breakpoint
CREATE INDEX "idx_fedcontent_object_uri" ON "federated_content" USING btree ("object_uri");--> statement-breakpoint
CREATE INDEX "idx_fed_content_builds_content_id" ON "federated_content_builds" USING btree ("federated_content_id");--> statement-breakpoint
CREATE INDEX "idx_fed_hub_members_hub" ON "federated_hub_members" USING btree ("federated_hub_id");--> statement-breakpoint
CREATE INDEX "idx_fed_hub_post_replies_post" ON "federated_hub_post_replies" USING btree ("federated_hub_post_id");--> statement-breakpoint
CREATE INDEX "idx_fed_hub_post_replies_author" ON "federated_hub_post_replies" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "idx_fedhubposts_hub_id" ON "federated_hub_posts" USING btree ("federated_hub_id");--> statement-breakpoint
CREATE INDEX "idx_fedhubposts_received_at" ON "federated_hub_posts" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "idx_fed_hub_products_hub" ON "federated_hub_products" USING btree ("federated_hub_id");--> statement-breakpoint
CREATE INDEX "idx_fed_hub_resources_hub" ON "federated_hub_resources" USING btree ("federated_hub_id");--> statement-breakpoint
CREATE INDEX "idx_fedhubs_origin_domain" ON "federated_hubs" USING btree ("origin_domain");--> statement-breakpoint
CREATE INDEX "idx_fedhubs_status_hidden" ON "federated_hubs" USING btree ("status","is_hidden");--> statement-breakpoint
CREATE INDEX "idx_fedhubs_name" ON "federated_hubs" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_fedhubs_remote_actor_id" ON "federated_hubs" USING btree ("remote_actor_id");--> statement-breakpoint
CREATE INDEX "idx_user_fed_hub_follow_user" ON "user_federated_hub_follows" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_fed_hub_follow_hub" ON "user_federated_hub_follows" USING btree ("federated_hub_id");--> statement-breakpoint
CREATE INDEX "idx_files_uploader_id" ON "files" USING btree ("uploader_id");--> statement-breakpoint
CREATE INDEX "idx_files_content_id" ON "files" USING btree ("content_id");--> statement-breakpoint
CREATE INDEX "idx_files_hub_id" ON "files" USING btree ("hub_id");--> statement-breakpoint
CREATE INDEX "idx_hub_bans_hub_id" ON "hub_bans" USING btree ("hub_id");--> statement-breakpoint
CREATE INDEX "idx_hub_bans_user_id" ON "hub_bans" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_hub_followers_fed_hub" ON "hub_followers_fed" USING btree ("hub_id");--> statement-breakpoint
CREATE INDEX "idx_hub_invites_hub_id" ON "hub_invites" USING btree ("hub_id");--> statement-breakpoint
CREATE INDEX "idx_hub_post_likes_post_id" ON "hub_post_likes" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "idx_hub_post_likes_user_id" ON "hub_post_likes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_hub_post_replies_post_id" ON "hub_post_replies" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "idx_hub_post_replies_author_id" ON "hub_post_replies" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "idx_hub_posts_hub_id" ON "hub_posts" USING btree ("hub_id");--> statement-breakpoint
CREATE INDEX "idx_hub_posts_author_id" ON "hub_posts" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "idx_hub_resources_hub_id" ON "hub_resources" USING btree ("hub_id");--> statement-breakpoint
CREATE INDEX "idx_hub_resources_added_by_id" ON "hub_resources" USING btree ("added_by_id");--> statement-breakpoint
CREATE INDEX "idx_hub_shares_hub_id" ON "hub_shares" USING btree ("hub_id");--> statement-breakpoint
CREATE INDEX "idx_hub_shares_content_id" ON "hub_shares" USING btree ("content_id");--> statement-breakpoint
CREATE INDEX "idx_hubs_created_by_id" ON "hubs" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "idx_hubs_hub_type" ON "hubs" USING btree ("hub_type");--> statement-breakpoint
CREATE INDEX "idx_bookmarks_target" ON "bookmarks" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "idx_bookmarks_user_id" ON "bookmarks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_comments_author_id" ON "comments" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "idx_comments_target" ON "comments" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "idx_comments_parent_id" ON "comments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_participants_gin" ON "conversations" USING gin ("participants");--> statement-breakpoint
CREATE INDEX "idx_follows_follower_id" ON "follows" USING btree ("follower_id");--> statement-breakpoint
CREATE INDEX "idx_follows_following_id" ON "follows" USING btree ("following_id");--> statement-breakpoint
CREATE INDEX "idx_likes_target" ON "likes" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "idx_message_reads_user_id" ON "message_reads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_messages_conversation_id" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_messages_sender_id" ON "messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_id" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_read" ON "notifications" USING btree ("user_id","read");--> statement-breakpoint
CREATE INDEX "idx_reports_reporter_id" ON "reports" USING btree ("reporter_id");--> statement-breakpoint
CREATE INDEX "idx_reports_status" ON "reports" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_content_product_unique" ON "content_products" USING btree ("content_id","product_id");--> statement-breakpoint
CREATE INDEX "idx_content_products_product_id" ON "content_products" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_products_hub_id" ON "products" USING btree ("hub_id");--> statement-breakpoint
CREATE INDEX "idx_products_created_by_id" ON "products" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "idx_certificates_path_id" ON "certificates" USING btree ("path_id");--> statement-breakpoint
CREATE INDEX "idx_enrollments_user_id" ON "enrollments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_enrollments_path_id" ON "enrollments" USING btree ("path_id");--> statement-breakpoint
CREATE INDEX "idx_learning_lessons_module_id" ON "learning_lessons" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "idx_learning_modules_path_id" ON "learning_modules" USING btree ("path_id");--> statement-breakpoint
CREATE INDEX "idx_learning_paths_author_id" ON "learning_paths" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "idx_learning_paths_status" ON "learning_paths" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_lesson_progress_lesson_id" ON "lesson_progress" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "idx_lesson_progress_user_id" ON "lesson_progress" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_videos_author_id" ON "videos" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "idx_videos_category_id" ON "videos" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_contest_entry_votes_entry_id" ON "contest_entry_votes" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "idx_contest_entry_votes_user_id" ON "contest_entry_votes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_hub_post_votes_post_id" ON "hub_post_votes" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "idx_hub_post_votes_user_id" ON "hub_post_votes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_poll_options_post_id" ON "poll_options" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "idx_poll_votes_option_id" ON "poll_votes" USING btree ("option_id");--> statement-breakpoint
CREATE INDEX "idx_poll_votes_user_id" ON "poll_votes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_api_key_usage_key_time" ON "api_key_usage" USING btree ("key_id","timestamp");--> statement-breakpoint
CREATE INDEX "idx_api_keys_prefix" ON "api_keys" USING btree ("prefix");--> statement-breakpoint
CREATE INDEX "idx_api_keys_active" ON "api_keys" USING btree ("revoked_at");