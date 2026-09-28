-- Supabase hardening (SPEC §1, §3). The app connects server-side as the table
-- owner, which bypasses RLS; Row Level Security with no policies means nothing
-- is reachable through PostgREST / the anon key even if `wiege` were exposed.
-- Keep one statement per breakpoint so every driver runs them identically.
ALTER TABLE "wiege"."sources" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "wiege"."articles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "wiege"."lessons" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "wiege"."definitions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "wiege"."ingest_runs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "wiege"."rate_limits" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Wiege's migration history table (created by the migrator before this runs).
ALTER TABLE IF EXISTS "wiege"."__wiege_migrations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Supabase's API roles only exist on Supabase, so the revokes are guarded; on
-- plain Postgres (local dev) and PGlite (tests) this block is a no-op.
DO $$
DECLARE
  api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA wiege FROM %I', api_role);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA wiege FROM %I', api_role);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA wiege FROM %I', api_role);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA wiege FROM %I', api_role);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA wiege REVOKE ALL ON TABLES FROM %I', api_role);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA wiege REVOKE ALL ON SEQUENCES FROM %I', api_role);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA wiege REVOKE ALL ON FUNCTIONS FROM %I', api_role);
    END IF;
  END LOOP;
END
$$;
