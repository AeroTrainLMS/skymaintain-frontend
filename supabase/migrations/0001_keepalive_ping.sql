-- 0001_keepalive_ping.sql
--
-- Creates the keepalive_ping() function used by:
--   * GET /api/keepalive  (skymain-frontend/app/api/keepalive/route.ts)
--   * The "Supabase Keep Warm" GitHub Actions workflow
--
-- It runs `select now()` so callers can PROVE the request reached Supabase
-- Postgres (returning the real database clock) instead of just receiving an
-- HTTP 200. Executing this query is also what keeps the free-tier project
-- from being paused for inactivity.
--
-- Apply it once via the Supabase SQL editor (Dashboard -> SQL -> New query)
-- or `psql`. Re-running is safe (create or replace).

create or replace function public.keepalive_ping()
returns timestamptz
language sql
stable
as $$
  select now();
$$;

-- The server-side route uses the service-role key; grant execute explicitly
-- so the RPC is callable (and so anon/authenticated cannot call it).
grant execute on function public.keepalive_ping() to service_role;
