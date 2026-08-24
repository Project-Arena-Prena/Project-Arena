-- Project Arena — take anon and authenticated off the service-role RPCs.
-- Idempotent. Safe to re-run.
--
-- schema.sql revokes these functions `from public`, and that was never enough.
-- Supabase ships default privileges on schema public, for BOTH the `postgres`
-- and `supabase_admin` grantors, that grant EXECUTE on every newly created
-- function to anon, authenticated and service_role. Those are explicit grants
-- to named roles, so `revoke ... from public` — which only drops the PUBLIC
-- pseudo-role — left them standing:
--
--   approve_entry        {postgres=X, anon=X, authenticated=X, service_role=X}
--   finalize_arena_by_id {postgres=X, anon=X, authenticated=X, service_role=X}
--   confirm_paid_entry   {postgres=X, anon=X, authenticated=X, service_role=X}
--
-- NEXT_PUBLIC_SUPABASE_ANON_KEY ships to every browser, and none of these
-- functions carries an internal is_admin() guard — they were written to rely on
-- the grant. So anyone could POST /rest/v1/rpc/approve_entry and approve an
-- unpaid entry, call confirm_paid_entry to manufacture a paid one, or call
-- finalize_arena_by_id to freeze a live board on a ranking they liked.
--
-- Every .rpc() call site in src/ goes through createAdminClient() (the
-- service_role key), so nothing in the app loses a capability here.
--
-- Three functions must keep caller access, because RLS policy expressions are
-- evaluated as the calling role and would otherwise fail closed for everyone:
--   is_admin()             — 17 policies
--   owns_project(uuid)     — projects read + update policies
--   slugify(text)          — retained from schema.sql
-- plus ensure_builder(), self-service and scoped to auth.uid().

-- ---------------------------------------------------------------------------
-- 1. Revoke EXECUTE on every function this project owns in public.
-- ---------------------------------------------------------------------------
-- No extension owns a function in public (extensions live in `extensions`), so
-- this cannot strip a gen_random_uuid() a column default depends on.

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and not exists (
        select 1 from pg_depend d
        where d.objid = p.oid
          and d.classid = 'pg_proc'::regclass
          and d.deptype = 'e'
      )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Re-grant the caller-facing allowlist.
-- ---------------------------------------------------------------------------

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.owns_project(uuid) to anon, authenticated;
grant execute on function public.slugify(text) to anon, authenticated;
grant execute on function public.ensure_builder() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Stop the next `create function` from re-opening the hole.
-- ---------------------------------------------------------------------------
-- Without this, migration 009 reintroduces the whole problem silently.
-- Default privileges are per-grantor; altering another role's set requires
-- membership in it, so a role we cannot alter is reported, not fatal.

do $$
declare
  grantor text;
begin
  foreach grantor in array array['postgres', 'supabase_admin']
  loop
    if not exists (select 1 from pg_roles where rolname = grantor) then
      continue;
    end if;
    begin
      execute format(
        'alter default privileges for role %I in schema public revoke execute on functions from anon, authenticated',
        grantor
      );
    exception when insufficient_privilege or invalid_grant_operation then
      raise warning
        'could not alter default privileges for role % — run this statement as that role, or new functions will keep granting EXECUTE to anon',
        grantor;
    end;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Assert the result. The migration fails rather than reporting a false pass.
-- ---------------------------------------------------------------------------

do $$
declare
  v_leaks text;
begin
  select string_agg(sig, ', ' order by sig) into v_leaks
  from (
    select p.oid::regprocedure::text as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.oid::regprocedure::text not in (
        'is_admin()',
        'owns_project(uuid)',
        'slugify(text)',
        'ensure_builder()'
      )
      and (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        or has_function_privilege('authenticated', p.oid, 'EXECUTE')
      )
  ) s;

  if v_leaks is not null then
    raise exception 'still executable by anon/authenticated: %', v_leaks;
  end if;

  -- The allowlist must survive, or every RLS policy calling it fails closed.
  if not has_function_privilege('anon', 'public.is_admin()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.owns_project(uuid)', 'EXECUTE') then
    raise exception 'RLS helper functions lost their grant';
  end if;

  -- service_role drives every RPC in src/. If it lost EXECUTE, the app is down.
  if not has_function_privilege('service_role', 'public.approve_entry(uuid)', 'EXECUTE') then
    raise exception 'service_role lost EXECUTE on approve_entry';
  end if;
end;
$$;
