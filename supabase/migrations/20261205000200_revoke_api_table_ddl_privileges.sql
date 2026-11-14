-- Security brief 2026-11-13 (docs/security/2026-11-13-brief-security-check.md), two LOW items:
--
-- 1. get_real_user_ids(text[]) is SECURITY DEFINER pinned to `search_path = public` without pg_temp
--    (20261116000000_scrape_hardening.sql section 3). pg_temp is searched FIRST unless it is named, so name
--    it last. ALTER FUNCTION ... SET replaces only the function's config: the body, owner, SECURITY DEFINER
--    and the EXECUTE grants (authenticated only) are untouched.
--
-- 2. Supabase's default privileges grant ALL on every new public table to anon and authenticated, so
--    18 tables carry anon=arwdDxtm (db-snapshot 2026-11-11) and every new table is born that way. RLS
--    governs SELECT/INSERT/UPDATE/DELETE; it does NOT govern TRUNCATE, and REFERENCES / TRIGGER /
--    MAINTAIN are DDL-side privileges no API role needs. PostgREST has no TRUNCATE verb, so this is a
--    standing footgun rather than a live path; it is removed here:
--      * REVOKE TRUNCATE, REFERENCES, TRIGGER (and MAINTAIN, Postgres 17+) on every public table,
--        view and materialized view FROM anon, authenticated -- by ROLE: `FROM PUBLIC` would not touch
--        Supabase's explicit per-role grants (CLAUDE.md, "Postgres function grants");
--      * the same revoke on the default privileges postgres's migrations create tables under, so a new
--        table is no longer born with them.
--    SELECT / INSERT / UPDATE / DELETE grants are deliberately NOT touched (RLS is their gate; changing
--    them is a separate decision, see deferred/20261116000002). service_role and the owner keep everything.
--
-- MAINTAIN is Postgres 17 syntax (prod is 17.4). It goes through a version check so the PGlite 16 chain
-- (supabase/tests/full_chain.ts) still applies this file; on prod the branch always runs.
--
-- KNOWN LIMIT (say what this does not cover): only the FOR ROLE postgres default rules are edited. Supabase
-- also keeps rules FOR ROLE supabase_admin IN SCHEMA public; postgres cannot alter another role's defaults,
-- so a table supabase_admin creates (a platform upgrade, not our migrations) is still born with them.
--
-- Tested: supabase/tests/revoke_api_table_ddl_privileges.pglite.test.ts (whole chain, Postgres 17).
--
-- POST-APPLY CHECKS (SQL editor, each on its own):
--   -- EXPECT 0 rows: no API role holds TRUNCATE / REFERENCES / TRIGGER / MAINTAIN on a public relation.
--   select c.relname, r.rolname, p.priv
--     from pg_class c join pg_namespace n on n.oid = c.relnamespace
--     cross join (values ('anon'), ('authenticated')) r(rolname)
--     cross join (values ('TRUNCATE'), ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')) p(priv)
--    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
--      and has_table_privilege(r.rolname, c.oid, p.priv);
--   -- EXPECT {"search_path=public, pg_temp"}
--   select proconfig from pg_proc where oid = 'public.get_real_user_ids(text[])'::regprocedure;
--   -- EXPECT the postgres 'r' rule with anon=arwd/postgres and authenticated=arwd/postgres
--   select pg_get_userbyid(defaclrole), defaclobjtype, defaclacl from pg_default_acl
--    where defaclnamespace = 'public'::regnamespace;

alter function public.get_real_user_ids(text[]) set search_path = public, pg_temp;

revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables from anon, authenticated;

do $$
begin
  if current_setting('server_version_num')::int >= 170000 then
    execute 'revoke maintain on all tables in schema public from anon, authenticated';
    execute 'alter default privileges for role postgres in schema public revoke maintain on tables from anon, authenticated';
  end if;
end
$$;
