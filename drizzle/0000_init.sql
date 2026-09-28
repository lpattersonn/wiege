CREATE SCHEMA IF NOT EXISTS "wiege";
--> statement-breakpoint
CREATE TABLE "wiege"."articles" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"source_id" text NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"author" text,
	"excerpt" text NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"safety" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"is_sample" boolean DEFAULT false NOT NULL,
	CONSTRAINT "articles_slug_unique" UNIQUE("slug"),
	CONSTRAINT "articles_url_unique" UNIQUE("url"),
	CONSTRAINT "articles_status_check" CHECK ("wiege"."articles"."status" in ('pending', 'ready', 'rejected', 'failed')),
	CONSTRAINT "articles_category_check" CHECK ("wiege"."articles"."category" in ('writing', 'games', 'art', 'sports'))
);
--> statement-breakpoint
CREATE TABLE "wiege"."definitions" (
	"word" text PRIMARY KEY NOT NULL,
	"data" jsonb,
	"source" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wiege"."ingest_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"trigger" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	CONSTRAINT "ingest_runs_trigger_check" CHECK ("wiege"."ingest_runs"."trigger" in ('cron', 'scheduler', 'manual', 'cli')),
	CONSTRAINT "ingest_runs_status_check" CHECK ("wiege"."ingest_runs"."status" in ('running', 'ok', 'partial', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "wiege"."lessons" (
	"article_id" text PRIMARY KEY NOT NULL,
	"content" jsonb NOT NULL,
	"generator" text NOT NULL,
	"model" text,
	"reading_grade" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lessons_generator_check" CHECK ("wiege"."lessons"."generator" in ('claude', 'heuristic', 'seed'))
);
--> statement-breakpoint
CREATE TABLE "wiege"."rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wiege"."sources" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"feed_url" text NOT NULL,
	"homepage" text NOT NULL,
	"category" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_fetched_at" timestamp with time zone,
	"last_error" text,
	"etag" text,
	"last_modified" text,
	CONSTRAINT "sources_feed_url_unique" UNIQUE("feed_url"),
	CONSTRAINT "sources_category_check" CHECK ("wiege"."sources"."category" in ('writing', 'games', 'art', 'sports'))
);
--> statement-breakpoint
ALTER TABLE "wiege"."articles" ADD CONSTRAINT "articles_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "wiege"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiege"."lessons" ADD CONSTRAINT "lessons_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "wiege"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "articles_status_category_published_idx" ON "wiege"."articles" USING btree ("status","category","published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "articles_status_published_idx" ON "wiege"."articles" USING btree ("status","published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "articles_content_hash_idx" ON "wiege"."articles" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "ingest_runs_started_idx" ON "wiege"."ingest_runs" USING btree ("started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "ingest_runs_single_running_idx" ON "wiege"."ingest_runs" USING btree ("status") WHERE "wiege"."ingest_runs"."status" = 'running';--> statement-breakpoint
CREATE INDEX "rate_limits_reset_idx" ON "wiege"."rate_limits" USING btree ("reset_at");