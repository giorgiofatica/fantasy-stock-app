-- ============================================================================
-- symbols.list_drop_held_at: POST-PUSH CHECKS, SQL editor. Read-only.
--   supabase/migrations/20261212100000_symbols_list_drop_held_at.sql
-- Run AFTER the db push and BEFORE deploying the enrich-symbols build that
-- reads the column (that build fails every run on a database without it).
-- ============================================================================
-- Submit each numbered block ON ITS OWN: an error skips the rest of a submitted
-- script and can leave the session in an aborted transaction.
--
-- The effect test (4) is also run on PGlite, on the whole migration chain, by
-- supabase/tests/symbols_list_drop_held_at.pglite.test.ts, which keeps it honest.
-- ============================================================================

-- 1. The migration is recorded. EXPECT one row: 20261212100000.
select version from supabase_migrations.schema_migrations where version = '20261212100000';

-- 2. The table's grants are UNCHANGED. EXPECT exactly (order may differ), as in
--    docs/architecture/db-snapshot.json (2026-11-24):
--    {postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}
select relacl from pg_class where oid = 'public.symbols'::regclass;

-- 3. Column grants are UNCHANGED: authenticated reads symbol, name, is_draftable
--    and nothing else; the new column has no grant of its own. EXPECT exactly
--    three rows, each {authenticated=r/postgres}: is_draftable, name, symbol.
select attname, attacl
  from pg_attribute
 where attrelid = 'public.symbols'::regclass and attacl is not null and not attisdropped
 order by attname;

-- 4. Effect test. EXPECT the notice "PASS: list_drop_held_at checks" and no error.
do $$
declare
  v record;
  acl_cols text[];
begin
  -- The column: timestamptz, nullable, no default.
  select data_type, is_nullable, column_default into v
    from information_schema.columns
   where table_schema = 'public' and table_name = 'symbols' and column_name = 'list_drop_held_at';
  if not found then raise exception 'FAIL: symbols.list_drop_held_at does not exist'; end if;
  if v.data_type <> 'timestamp with time zone' or v.is_nullable <> 'YES' or v.column_default is not null then
    raise exception 'FAIL: list_drop_held_at is % / nullable % / default %', v.data_type, v.is_nullable, v.column_default;
  end if;

  -- No API role can read or write it; service_role (enrich-symbols) can.
  if has_column_privilege('authenticated', 'public.symbols', 'list_drop_held_at', 'SELECT')
     or has_column_privilege('authenticated', 'public.symbols', 'list_drop_held_at', 'UPDATE')
     or has_column_privilege('anon', 'public.symbols', 'list_drop_held_at', 'SELECT')
     or has_column_privilege('anon', 'public.symbols', 'list_drop_held_at', 'UPDATE') then
    raise exception 'FAIL: an API role holds a privilege on list_drop_held_at';
  end if;
  if not has_column_privilege('service_role', 'public.symbols', 'list_drop_held_at', 'SELECT')
     or not has_column_privilege('service_role', 'public.symbols', 'list_drop_held_at', 'UPDATE') then
    raise exception 'FAIL: service_role cannot read and write list_drop_held_at (enrich-symbols needs both)';
  end if;

  -- authenticated's allow list is still exactly symbol, name, is_draftable.
  select array_agg(attname::text order by attname) into acl_cols
    from pg_attribute
   where attrelid = 'public.symbols'::regclass and attacl is not null and not attisdropped;
  if acl_cols is distinct from array['is_draftable', 'name', 'symbol'] then
    raise exception 'FAIL: columns with grants are %, expected {is_draftable,name,symbol}', acl_cols;
  end if;
  if has_table_privilege('authenticated', 'public.symbols', 'SELECT')
     or has_table_privilege('anon', 'public.symbols', 'SELECT') then
    raise exception 'FAIL: an API role holds a table-level SELECT on symbols';
  end if;

  -- The partial index for the one read per run.
  if not exists (select 1 from pg_indexes
                  where schemaname = 'public' and tablename = 'symbols'
                    and indexname = 'symbols_list_drop_held_at_idx') then
    raise exception 'FAIL: index symbols_list_drop_held_at_idx missing';
  end if;

  -- A hold must not look like a change to the stock: not in the updated_at
  -- trigger. The trigger must exist (a missing one would read as NULL, not a FAIL).
  select pg_get_triggerdef(t.oid) into v from pg_trigger t
   where t.tgrelid = 'public.symbols'::regclass and t.tgname = 'symbols_touch_updated_at';
  if not found then raise exception 'FAIL: trigger symbols_touch_updated_at is missing'; end if;
  if v.pg_get_triggerdef like '%list_drop_held_at%' then
    raise exception 'FAIL: symbols_touch_updated_at watches list_drop_held_at';
  end if;

  raise notice 'PASS: list_drop_held_at checks';
end $$;

-- 5. Nothing is held yet. EXPECT 0 before the enrich-symbols deploy. After it,
--    a non-zero count means a run refused a mass drop: read its log line
--    (`enrich-symbols {"ok":false,"error":"mass_drop_refused",...}`).
select count(*) as held, max(list_drop_held_at) as last_held
  from public.symbols where list_drop_held_at is not null;
